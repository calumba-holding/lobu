import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateWorkerToken } from "@lobu/core";
import { Hono } from "hono";
import { ArtifactStore } from "../files/artifact-store";
import type { PlatformRegistry } from "../platform";
import { createFileRoutes } from "../routes/internal/files";
import { createPublicFileRoutes } from "../routes/public/files";

const originalEncryptionKey = process.env.ENCRYPTION_KEY;

describe("file routes", () => {
  let artifactsDir: string;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.from(
      "12345678901234567890123456789012"
    ).toString("base64");
    artifactsDir = mkdtempSync(join(tmpdir(), "lobu-artifacts-test-"));
  });

  afterEach(async () => {
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
    await rm(artifactsDir, { recursive: true, force: true });
  });

  test("falls back to a signed artifact URL when no platform file handler exists", async () => {
    const artifactStore = new ArtifactStore(artifactsDir);
    const app = new Hono();
    const platformRegistry = {
      get: () => ({ getFileHandler: () => undefined }),
    } as unknown as PlatformRegistry;

    app.route(
      "/internal/files",
      createFileRoutes(
        platformRegistry,
        artifactStore,
        "https://gateway.example.com"
      )
    );
    app.route("", createPublicFileRoutes(artifactStore));

    const token = generateWorkerToken("user-1", "conv-1", "worker-1", {
      channelId: "channel-1",
      platform: "telegram",
    });

    const form = new FormData();
    form.set(
      "file",
      new File(["hello artifact"], "proof.txt", { type: "text/plain" })
    );
    form.set("filename", "proof.txt");

    const uploadResponse = await app.request("/internal/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Channel-Id": "channel-1",
        "X-Conversation-Id": "conv-1",
      },
      body: form,
    });

    expect(uploadResponse.status).toBe(200);
    const uploadBody = (await uploadResponse.json()) as {
      success: boolean;
      fileId: string;
      permalink: string;
      name: string;
      size: number;
      delivery: string;
      artifactId?: string;
    };

    expect(uploadBody.success).toBe(true);
    expect(uploadBody.delivery).toBe("artifact-url");
    expect(uploadBody.name).toBe("proof.txt");
    expect(uploadBody.permalink).toContain("/api/v1/files/");
    expect(uploadBody.artifactId).toBe(uploadBody.fileId);

    const downloadUrl = new URL(uploadBody.permalink);
    const downloadResponse = await app.request(
      `${downloadUrl.pathname}${downloadUrl.search}`
    );

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toContain(
      "text/plain"
    );
    expect(downloadResponse.headers.get("content-disposition")).toContain(
      'filename="proof.txt"'
    );
    expect(await downloadResponse.text()).toBe("hello artifact");
  });

  test("falls back to a signed artifact URL when platform upload fails", async () => {
    const artifactStore = new ArtifactStore(artifactsDir);
    const app = new Hono();
    let uploadAttempts = 0;
    const platformRegistry = {
      get: () => ({
        getFileHandler: () => ({
          uploadFile: async () => {
            uploadAttempts += 1;
            throw new Error("telegram upload failed");
          },
        }),
      }),
    } as unknown as PlatformRegistry;

    app.route(
      "/internal/files",
      createFileRoutes(
        platformRegistry,
        artifactStore,
        "https://gateway.example.com"
      )
    );
    app.route("", createPublicFileRoutes(artifactStore));

    const token = generateWorkerToken("user-1", "conv-1", "worker-1", {
      channelId: "channel-1",
      platform: "telegram",
    });

    const form = new FormData();
    form.set(
      "file",
      new File(["fallback artifact"], "fallback.txt", { type: "text/plain" })
    );
    form.set("filename", "fallback.txt");

    const uploadResponse = await app.request("/internal/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Channel-Id": "channel-1",
        "X-Conversation-Id": "conv-1",
      },
      body: form,
    });

    expect(uploadAttempts).toBe(1);
    expect(uploadResponse.status).toBe(200);
    const uploadBody = (await uploadResponse.json()) as {
      success: boolean;
      delivery: string;
      name: string;
      permalink: string;
    };

    expect(uploadBody.success).toBe(true);
    expect(uploadBody.delivery).toBe("artifact-url");
    expect(uploadBody.name).toBe("fallback.txt");
    expect(uploadBody.permalink).toContain("/api/v1/files/");
  });
});
