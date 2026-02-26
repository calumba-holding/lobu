import type { CommandContext } from "@lobu/core";
import type { WebClient } from "@slack/web-api";
import type { Bot } from "grammy";

export function createSlackThreadReply(
  client: WebClient,
  channelId: string,
  threadTs: string
): CommandContext["reply"] {
  return async (text: string) => {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text,
    });
  };
}

export function createSlackEphemeralReply(
  client: WebClient,
  channelId: string,
  userId: string
): CommandContext["reply"] {
  return async (text: string) => {
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text,
    });
  };
}

export function createTelegramReply(
  bot: Bot,
  chatId: number
): CommandContext["reply"] {
  return async (text: string) => {
    // Extract URL from text for inline button (settings/agent-selector links)
    const urlMatch = text.match(/https?:\/\/\S+/);
    if (urlMatch) {
      const url = urlMatch[0];
      const buttonText = url.includes("/settings")
        ? "Open Settings"
        : "Configure Agent";
      try {
        await bot.api.sendMessage(chatId, text, {
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, url }]],
          },
        });
        return;
      } catch {
        // Fall through to plain text if button fails (e.g. localhost URLs)
      }
    }
    await bot.api.sendMessage(chatId, text);
  };
}
