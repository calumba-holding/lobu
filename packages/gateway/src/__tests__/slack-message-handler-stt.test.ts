import { afterEach, describe, expect, mock, test } from "bun:test";
import type { MessageHandlerConfig } from "../slack/config";
import { MessageHandler } from "../slack/events/messages";

describe("Slack MessageHandler STT", () => {
  const baseConfig: MessageHandlerConfig = {
    slack: {
      token: "xoxb-test",
      socketMode: true,
      port: 3000,
      apiUrl: "https://slack.com/api",
    },
    agentOptions: {},
    sessionTimeoutMinutes: 30,
  };

  afterEach(() => {
    mock.restore();
  });

  test("uses resolved agentId for audio transcription", async () => {
    const queueProducer = {
      enqueueMessage: mock(async () => "job-1"),
    } as any;
    const sessionManager = {
      validateThreadOwnership: mock(async () => ({ allowed: true })),
      findSessionByThread: mock(async () => null),
      setSession: mock(async () => undefined),
    } as any;
    const slackClient = {
      apiCall: mock(async () => ({ ok: true })),
    } as any;

    const handler = new MessageHandler(
      queueProducer,
      baseConfig,
      sessionManager,
      slackClient
    );

    handler.setChannelBindingService({
      getBinding: mock(async () => ({ agentId: "agent-slack" })),
    } as any);

    const transcribe = mock(async () => ({
      text: "transcribed text",
      provider: "openai",
    }));
    handler.setTranscriptionService({ transcribe } as any);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(Buffer.from("audio-bytes"), {
        status: 200,
        headers: { "Content-Type": "audio/ogg" },
      });
    }) as any;

    try {
      await handler.handleUserRequest(
        {
          userId: "U1",
          channelId: "D123",
          teamId: "T1",
          messageTs: "111.222",
          threadTs: "111.222",
          userDisplayName: "Tester",
        } as any,
        "[Audio message]",
        { token: "xoxb-test" } as any,
        [
          {
            id: "F1",
            mimetype: "audio/ogg",
            filetype: "ogg",
            url_private_download: "https://files.slack.test/audio.ogg",
          },
        ]
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0]?.[1]).toBe("agent-slack");
    const payload = queueProducer.enqueueMessage.mock.calls[0]?.[0] as any;
    expect(payload.messageText).toContain("[Voice message]: transcribed text");
  });

  test("sends Slack config prompt once when STT provider is missing", async () => {
    const queueProducer = {
      enqueueMessage: mock(async () => "job-1"),
    } as any;
    const sessionManager = {
      validateThreadOwnership: mock(async () => ({ allowed: true })),
      findSessionByThread: mock(async () => null),
      setSession: mock(async () => undefined),
    } as any;
    const slackClient = {
      apiCall: mock(async () => ({ ok: true })),
    } as any;

    const handler = new MessageHandler(
      queueProducer,
      baseConfig,
      sessionManager,
      slackClient
    );
    handler.setChannelBindingService({
      getBinding: mock(async () => ({ agentId: "agent-slack" })),
    } as any);
    handler.setTranscriptionService({
      transcribe: mock(async () => ({
        error: "No transcription provider configured",
        availableProviders: ["openai"],
      })),
    } as any);
    handler.setUserAgentsStore({} as any);
    handler.setAgentMetadataStore({} as any);
    handler.setClaimService({
      createClaim: mock(async () => "claim-1"),
    } as any);
    let alreadySent = false;
    handler.setSystemMessageLimiter({
      sendOnce: mock(async (_key: string, sendFn: () => Promise<void>) => {
        if (alreadySent) {
          return false;
        }
        alreadySent = true;
        await sendFn();
        return true;
      }),
    } as any);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(Buffer.from("audio-bytes"), {
        status: 200,
        headers: { "Content-Type": "audio/ogg" },
      });
    }) as any;

    const requestClient = {
      token: "xoxb-test",
      chat: {
        postMessage: mock(async () => ({ ok: true })),
      },
    } as any;

    try {
      const context = {
        userId: "U1",
        channelId: "D123",
        teamId: "T1",
        messageTs: "111.222",
        threadTs: "111.222",
        userDisplayName: "Tester",
      } as any;

      await handler.handleUserRequest(
        context,
        "[Audio message]",
        requestClient,
        [
          {
            id: "F1",
            mimetype: "audio/ogg",
            filetype: "ogg",
            url_private_download: "https://files.slack.test/audio.ogg",
          },
        ]
      );
      await handler.handleUserRequest(
        { ...context, messageTs: "111.223" },
        "[Audio message]",
        requestClient,
        [
          {
            id: "F2",
            mimetype: "audio/ogg",
            filetype: "ogg",
            url_private_download: "https://files.slack.test/audio2.ogg",
          },
        ]
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requestClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(queueProducer.enqueueMessage).toHaveBeenCalledTimes(2);
  });
});
