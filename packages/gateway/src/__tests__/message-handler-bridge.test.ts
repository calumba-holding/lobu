import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  type InboundAttachmentLike,
  ingestInboundAttachments,
  isSenderAllowed,
} from "../connections/message-handler-bridge";
import {
  type ArtifactTestEnv,
  createArtifactTestEnv,
  TEST_GATEWAY_URL,
} from "./setup";

describe("isSenderAllowed", () => {
  test.each([
    { allow: undefined, user: "user-1", expected: true, label: "no allowlist" },
    { allow: [], user: "user-1", expected: false, label: "empty allowlist" },
    { allow: ["user-1"], user: "user-1", expected: true, label: "listed user" },
    {
      allow: ["user-1"],
      user: "user-2",
      expected: false,
      label: "unlisted user",
    },
  ] as const)("$label → $expected", ({ allow, user, expected }) => {
    expect(isSenderAllowed(allow as string[] | undefined, user)).toBe(expected);
  });
});

describe("ingestInboundAttachments", () => {
  let env: ArtifactTestEnv;
  const ingest = (atts: InboundAttachmentLike[] | undefined) =>
    ingestInboundAttachments(atts, env.artifactStore, TEST_GATEWAY_URL);

  beforeEach(() => {
    env = createArtifactTestEnv();
  });

  afterEach(() => env.cleanup());

  test("returns empty arrays when there are no attachments", async () => {
    const result = await ingest(undefined);
    expect(result).toEqual({ files: [], audioBytes: [] });
  });

  test("publishes every attachment as an artifact and surfaces a signed downloadUrl", async () => {
    let pdfFetched = 0;
    const { files } = await ingest([
      {
        type: "image",
        name: "screenshot.png",
        mimeType: "image/png",
        data: Buffer.from("png-bytes"),
      },
      {
        type: "file",
        name: "report.pdf",
        mimeType: "application/pdf",
        fetchData: async () => {
          pdfFetched += 1;
          return Buffer.from("pdf-bytes");
        },
      },
    ]);

    expect(pdfFetched).toBe(1);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({
      name: "screenshot.png",
      mimetype: "image/png",
      size: Buffer.from("png-bytes").length,
    });
    expect(files[1]).toMatchObject({
      name: "report.pdf",
      mimetype: "application/pdf",
      size: Buffer.from("pdf-bytes").length,
    });
    for (const file of files) {
      expect(file.id).toBeTruthy();
      expect(file.downloadUrl).toContain("/api/v1/files/");
      expect(file.downloadUrl).toContain("token=");
    }
  });

  test("audio attachments are published AND surfaced for transcription", async () => {
    const { files, audioBytes } = await ingest([
      {
        type: "audio",
        name: "voice.ogg",
        mimeType: "audio/ogg",
        fetchData: async () => Buffer.from("opus-bytes"),
      },
      {
        type: "audio",
        name: "alt.ogg",
        mimeType: "application/ogg",
        fetchData: async () => Buffer.from("vorbis-bytes"),
      },
    ]);

    // Audio still goes through artifact publishing so the worker can refer
    // to the original recording, AND its bytes are returned for immediate
    // transcription.
    expect(files).toHaveLength(2);
    expect(audioBytes).toHaveLength(2);
    expect(audioBytes[0]?.buffer.toString()).toBe("opus-bytes");
    expect(audioBytes[0]?.mimeType).toBe("audio/ogg");
    expect(audioBytes[1]?.mimeType).toBe("application/ogg");
  });

  // A bad attachment must never abort the rest of the batch — whether it has
  // no fetchable bytes or its fetchData throws, the good one still publishes.
  test.each([
    {
      label: "no fetchable bytes",
      bad: { type: "file", name: "empty.txt", mimeType: "text/plain" },
    },
    {
      label: "fetchData throws",
      bad: {
        type: "file",
        name: "boom.bin",
        mimeType: "application/octet-stream",
        fetchData: async () => {
          throw new Error("network down");
        },
      },
    },
  ] as const)(
    "skips $label and still publishes the rest of the batch",
    async ({ bad }) => {
      const { files } = await ingest([
        bad as InboundAttachmentLike,
        {
          type: "file",
          name: "ok.txt",
          mimeType: "text/plain",
          data: Buffer.from("ok"),
        },
      ]);

      expect(files).toHaveLength(1);
      expect(files[0]?.name).toBe("ok.txt");
    }
  );

  test("derives a filename from mimeType + index when none is provided", async () => {
    const { files } = await ingest([
      { type: "image", mimeType: "image/jpeg", data: Buffer.from("jpg") },
    ]);
    expect(files[0]?.name).toBe("image-1.jpeg");
  });
});
