import type { CommandContext } from "@lobu/core";
import type { WebClient } from "@slack/web-api";
import type { Bot } from "grammy";

export function createSlackThreadReply(
  client: WebClient,
  channelId: string,
  threadTs: string
): CommandContext["reply"] {
  return async (text, options) => {
    if (options?.url) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text } },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: options.urlLabel || "Open" },
                url: options.url,
                action_id: "cmd_link",
              },
            ],
          },
        ],
      });
      return;
    }
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
  return async (text, options) => {
    if (options?.url) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text } },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: options.urlLabel || "Open" },
                url: options.url,
                action_id: "cmd_link",
              },
            ],
          },
        ],
      });
      return;
    }
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
  const isGroup = chatId < 0;
  return async (text, options) => {
    if (options?.url) {
      // Groups: always use `url` button (web_app is only allowed in private chats)
      // DMs: default to `url` button; use `web_app` only when explicitly requested
      const useWebApp = !isGroup && options.webApp === true;
      const button = useWebApp
        ? { text: options.urlLabel || "Open", web_app: { url: options.url } }
        : { text: options.urlLabel || "Open", url: options.url };
      try {
        await bot.api.sendMessage(chatId, text, {
          reply_markup: {
            inline_keyboard: [[button]],
          },
        });
        return;
      } catch (err) {
        console.error(
          "[telegram-reply] button failed, falling back to plain text",
          err
        );
      }
    }
    await bot.api.sendMessage(chatId, text);
  };
}
