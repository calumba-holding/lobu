import { afterEach, describe, expect, mock, test } from "bun:test";
import { Readable } from "node:stream";
import type { TelegramConfig } from "../telegram/config";
import { TelegramMessageHandler } from "../telegram/events/message-handler";

const baseConfig: TelegramConfig = {
  enabled: true,
  botToken: "test-token",
  allowFrom: [],
  allowGroups: true,
  messageChunkSize: 4096,
  maxHistoryMessages: 10,
  historyTtlSeconds: 3600,
  webhookSecret: "secret",
};

function createHandler() {
  const queueProducer = {
    enqueueMessage: mock(async () => "job-1"),
  } as any;

  const bot = {
    api: {
      getMe: mock(async () => ({ id: 42, username: "lobu_bot" })),
      sendMessage: mock(async () => ({})),
    },
    on: mock(() => undefined),
  } as any;

  const handler = new TelegramMessageHandler(
    bot,
    baseConfig,
    queueProducer,
    {} as any,
    {}
  );

  handler.setFileHandler({
    downloadFile: mock(async () => ({
      stream: Readable.from([Buffer.from("audio-data")]),
      metadata: {
        id: "voice-file",
        name: "voice.ogg",
        mimetype: "audio/ogg",
        size: 10,
        url: "https://example.com/voice.ogg",
      },
    })),
  } as any);

  return { handler, queueProducer };
}

describe("TelegramMessageHandler voice/audio transcription", () => {
  afterEach(() => {
    mock.restore();
  });

  test("transcribes DM voice message and includes files metadata", async () => {
    const { handler, queueProducer } = createHandler();
    const transcribe = mock(async () => ({
      text: "hello world",
      provider: "openai",
    }));
    handler.setTranscriptionService({ transcribe } as any);
    (handler as any).botUserId = 42;
    (handler as any).botUsername = "lobu_bot";

    await (handler as any).processMessage({
      message: {
        message_id: 1001,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 12345, type: "private" },
        from: { id: 777, username: "alice", first_name: "Alice" },
        voice: {
          file_id: "voice-file",
          mime_type: "audio/ogg",
          file_size: 111,
        },
      },
    });

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0]?.[1]).toBe("telegram-777");
    expect(queueProducer.enqueueMessage).toHaveBeenCalledTimes(1);

    const payload = queueProducer.enqueueMessage.mock.calls[0]?.[0] as any;
    expect(payload.messageText).toContain("[Voice message]: hello world");
    expect(payload.platformMetadata.files).toEqual([
      {
        id: "voice-file",
        name: "voice_1001.ogg",
        mimetype: "audio/ogg",
        size: 111,
      },
    ]);
  });

  test("skips group audio unless replying to bot", async () => {
    const { handler, queueProducer } = createHandler();
    const transcribe = mock(async () => ({
      text: "hello",
      provider: "openai",
    }));
    handler.setTranscriptionService({ transcribe } as any);
    (handler as any).botUserId = 42;
    (handler as any).botUsername = "lobu_bot";

    await (handler as any).processMessage({
      message: {
        message_id: 1002,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -99, type: "supergroup" },
        from: { id: 777, username: "alice", first_name: "Alice" },
        voice: {
          file_id: "voice-file",
          mime_type: "audio/ogg",
          file_size: 111,
        },
      },
    });

    expect(queueProducer.enqueueMessage).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  test("adds transcription-unavailable fallback when provider is missing", async () => {
    const { handler, queueProducer } = createHandler();
    handler.setTranscriptionService({
      transcribe: mock(async () => ({
        error: "No transcription provider configured",
        availableProviders: ["openai", "gemini"],
      })),
    } as any);
    (handler as any).botUserId = 42;
    (handler as any).botUsername = "lobu_bot";

    await (handler as any).processMessage({
      message: {
        message_id: 1003,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 12345, type: "private" },
        from: { id: 777, username: "alice", first_name: "Alice" },
        voice: {
          file_id: "voice-file",
          mime_type: "audio/ogg",
          file_size: 111,
        },
      },
    });

    const payload = queueProducer.enqueueMessage.mock.calls[0]?.[0] as any;
    expect(payload.messageText).toContain("transcription unavailable");
    expect(payload.messageText).toContain("openai, gemini");
  });

  test("sends Telegram config prompt once when STT provider is missing", async () => {
    const { handler, queueProducer } = createHandler();
    const transcribe = mock(async () => ({
      error: "No transcription provider configured",
      availableProviders: ["openai"],
    }));
    handler.setTranscriptionService({ transcribe } as any);
    handler.setUserAgentsStore({} as any);
    handler.setAgentMetadataStore({
      getMetadata: mock(async () => ({ id: "telegram-777" })),
      createAgent: mock(async () => undefined),
    } as any);
    handler.setSystemMessageLimiter({
      sendOnce: mock(async (_key: string, sendFn: () => Promise<void>) => {
        if ((handler as any).__sttPromptSent) {
          return false;
        }
        (handler as any).__sttPromptSent = true;
        await sendFn();
        return true;
      }),
    } as any);
    (handler as any).botUserId = 42;
    (handler as any).botUsername = "lobu_bot";

    await (handler as any).processMessage({
      message: {
        message_id: 1101,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 12345, type: "private" },
        from: { id: 777, username: "alice", first_name: "Alice" },
        voice: {
          file_id: "voice-file",
          mime_type: "audio/ogg",
          file_size: 111,
        },
      },
    });
    await (handler as any).processMessage({
      message: {
        message_id: 1102,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 12345, type: "private" },
        from: { id: 777, username: "alice", first_name: "Alice" },
        voice: {
          file_id: "voice-file",
          mime_type: "audio/ogg",
          file_size: 111,
        },
      },
    });

    const bot = (handler as any).bot;
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
    expect(queueProducer.enqueueMessage).toHaveBeenCalledTimes(2);
  });
});
