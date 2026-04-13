import { afterEach, describe, expect, mock, test } from "bun:test";
import { Readable } from "node:stream";
import { ChatInstanceManager } from "../connections/chat-instance-manager";

const originalFetch = globalThis.fetch;

describe("ChatInstanceManager platform file handlers", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test("provides a telegram file handler that uploads via the active connection", async () => {
    const manager = new ChatInstanceManager() as any;
    manager.instances = new Map([
      [
        "conn-1",
        {
          connection: {
            id: "conn-1",
            platform: "telegram",
            config: { botToken: "telegram-token" },
            metadata: { botUsername: "owlettobot" },
          },
          chat: {},
        },
      ],
    ]);

    const adapter = manager
      .createPlatformAdapters()
      .find((platform) => platform.name === "telegram");
    const handler = adapter?.getFileHandler?.({
      connectionId: "conn-1",
      channelId: "6570514069",
      conversationId: "6570514069",
    });

    expect(handler).toBeDefined();

    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        expect(init?.method).toBe("POST");
        expect(url).toBe(
          "https://api.telegram.org/bottelegram-token/sendDocument"
        );
        return Response.json({
          ok: true,
          result: {
            message_id: 321,
            document: { file_id: "file-123" },
          },
        });
      }
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await handler!.uploadFile(
      Readable.from(Buffer.from("hello")),
      {
        filename: "test.txt",
        channelId: "6570514069",
        threadTs: "6570514069",
      }
    );

    expect(result).toEqual({
      fileId: "file-123",
      permalink: "https://t.me/owlettobot",
      name: "test.txt",
      size: 5,
    });
  });

  test("provides a telegram file handler that downloads files via Telegram getFile", async () => {
    const manager = new ChatInstanceManager() as any;
    manager.instances = new Map([
      [
        "conn-1",
        {
          connection: {
            id: "conn-1",
            platform: "telegram",
            config: { botToken: "telegram-token" },
            metadata: {},
          },
          chat: {},
        },
      ],
    ]);

    const adapter = manager
      .createPlatformAdapters()
      .find((platform) => platform.name === "telegram");
    const handler = adapter?.getFileHandler?.({ connectionId: "conn-1" });

    let call = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      call += 1;
      const url = String(input);
      if (call === 1) {
        expect(url).toBe("https://api.telegram.org/bottelegram-token/getFile");
        return Response.json({
          ok: true,
          result: {
            file_path: "documents/test.txt",
            file_size: 5,
          },
        });
      }
      expect(url).toBe(
        "https://api.telegram.org/file/bottelegram-token/documents/test.txt"
      );
      return new Response(Buffer.from("hello"));
    }) as unknown as typeof fetch;

    const result = await handler!.downloadFile("file-123");
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks).toString("utf8")).toBe("hello");
    expect(result.metadata.name).toBe("test.txt");
    expect(result.metadata.size).toBe(5);
  });
});
