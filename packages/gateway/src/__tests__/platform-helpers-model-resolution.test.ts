import { describe, expect, test } from "bun:test";
import {
  hasConfiguredProvider,
  resolveAgentId,
  resolveAgentOptions,
} from "../services/platform-helpers";

describe("resolveAgentOptions model resolution", () => {
  test("uses pinned model when pinned provider is installed", async () => {
    const settingsStore = {
      getEffectiveSettings: async () =>
        ({
          modelSelection: {
            mode: "pinned",
            pinnedModel: "openai/gpt-5",
          },
          installedProviders: [{ providerId: "openai", installedAt: 1 }],
        }) as any,
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
      getEffectiveSettings: async () =>
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
      getEffectiveSettings: async () =>
        ({
          modelSelection: {
            mode: "auto",
          },
          installedProviders: [{ providerId: "chatgpt", installedAt: 1 }],
        }) as any,
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

describe("hasConfiguredProvider", () => {
  test("accepts inherited template credentials from effective settings", async () => {
    const settingsStore = {
      getEffectiveSettings: async () =>
        ({
          authProfiles: [
            {
              id: "profile-1",
              provider: "z-ai",
              credential: "secret",
              authType: "api-key",
              label: "z.ai",
              model: "*",
              createdAt: 1,
            },
          ],
          installedProviders: [{ providerId: "z-ai", installedAt: 1 }],
        }) as any,
    };

    await expect(
      hasConfiguredProvider("telegram-6570514069", settingsStore as any)
    ).resolves.toBe(true);
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
