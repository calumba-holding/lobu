import { describe, expect, test } from "bun:test";
import {
  resolveAgentId,
  resolveAgentOptions,
} from "../services/platform-helpers";

describe("resolveAgentOptions model resolution", () => {
  test("uses pinned model when pinned provider is installed", async () => {
    const settingsStore = {
      getSettings: async () =>
        ({
          modelSelection: {
            mode: "pinned",
            pinnedModel: "openai/gpt-5",
          },
          installedProviders: [{ providerId: "openai", installedAt: 1 }],
        }) as any,
    };

    const resolved = await resolveAgentOptions(
      "agent-1",
      { model: "fallback-model" },
      settingsStore as any
    );

    expect(resolved.model).toBe("openai/gpt-5");
  });

  test("uses primary provider preference in auto mode", async () => {
    const settingsStore = {
      getSettings: async () =>
        ({
          modelSelection: {
            mode: "auto",
          },
          installedProviders: [
            { providerId: "chatgpt", installedAt: 1 },
            { providerId: "claude", installedAt: 2 },
          ],
          providerModelPreferences: {
            chatgpt: "chatgpt/gpt-5",
            claude: "claude/sonnet",
          },
        }) as any,
    };

    const resolved = await resolveAgentOptions(
      "agent-1",
      { model: "fallback-model" },
      settingsStore as any
    );

    expect(resolved.model).toBe("chatgpt/gpt-5");
  });

  test("clears model in auto mode when providers exist but no preference", async () => {
    const settingsStore = {
      getSettings: async () =>
        ({
          modelSelection: {
            mode: "auto",
          },
          installedProviders: [{ providerId: "chatgpt", installedAt: 1 }],
        }) as any,
    };

    const resolved = await resolveAgentOptions(
      "agent-1",
      { model: "fallback-model" },
      settingsStore as any
    );

    expect(resolved.model).toBeUndefined();
  });
});

describe("resolveAgentId", () => {
  test("uses deterministic id by default", async () => {
    const resolved = await resolveAgentId({
      platform: "telegram",
      userId: "777",
      channelId: "12345",
      isGroup: false,
    });

    expect(resolved).toEqual({
      agentId: "telegram-777",
      promptSent: false,
    });
  });
});
