import { createLogger } from "@lobu/core";
import type Redis from "ioredis";
import type {
  InteractionService,
  PostedLinkButton,
  PostedQuestion,
  PostedStatusMessage,
  PostedToolApproval,
} from "../interactions";
import type { GrantStore } from "../permissions/grant-store";
import type { ChatInstanceManager } from "./chat-instance-manager";
import type { PlatformConnection } from "./types";

const logger = createLogger("chat-interaction-bridge");

const PENDING_TTL = 5 * 60_000; // 5 minutes (in-memory cleanup)
const PENDING_TOOL_KEY_PREFIX = "pending-tool:";

/** Signature for the direct tool execution function injected from the MCP proxy. */
export type ExecuteToolDirectFn = (
  agentId: string,
  userId: string,
  mcpId: string,
  toolName: string,
  args: Record<string, unknown>
) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}>;

async function postWithFallback(
  thread: any,
  primary: { card: any; fallbackText: string },
  connectionId: string,
  context: string
): Promise<void> {
  try {
    await thread.post(primary);
  } catch (error) {
    logger.warn(
      { connectionId, error: String(error) },
      `Failed to post ${context}`
    );
    try {
      await thread.post(primary.fallbackText);
    } catch {
      // give up
    }
  }
}

/**
 * Send a message with inline keyboard buttons via the Telegram Bot API.
 * Used for interactive elements (tool approvals, questions) since
 * the Chat SDK does not support Telegram's inline keyboard natively.
 */
async function sendTelegramInlineKeyboard(
  botToken: string,
  chatId: string,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: { inline_keyboard: buttons },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

function resolveGrantExpiresAt(duration: string): number | null {
  switch (duration) {
    case "once":
      return Date.now() + 60_000;
    case "1h":
      return Date.now() + 3_600_000;
    case "24h":
      return Date.now() + 86_400_000;
    case "always":
      return null;
    default:
      return null;
  }
}

async function getPendingToolInvocation(
  redis: Redis,
  requestId: string
): Promise<{
  mcpId: string;
  toolName: string;
  args: Record<string, unknown>;
  agentId: string;
  userId: string;
} | null> {
  const raw = await redis.get(`${PENDING_TOOL_KEY_PREFIX}${requestId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatToolArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v);
      return `  ${k}: ${val}`;
    })
    .join("\n");
}

export function registerInteractionBridge(
  interactionService: InteractionService,
  manager: ChatInstanceManager,
  connection: PlatformConnection,
  chat: any,
  grantStore?: GrantStore,
  executeToolDirect?: ExecuteToolDirectFn
): () => void {
  const { id: connectionId, platform } = connection;

  // Per-connection state (avoids cross-contamination between connections)
  const handledEvents = new Set<string>();
  const activeTimers = new Set<NodeJS.Timeout>();
  function markHandled(id: string): void {
    handledEvents.add(id);
    const timer = setTimeout(() => {
      handledEvents.delete(id);
      activeTimers.delete(timer);
    }, 30_000);
    activeTimers.add(timer);
  }
  const pendingQuestionOptions = new Map<string, string[]>();

  const onQuestionCreated = async (event: PostedQuestion) => {
    try {
      if (!shouldHandle(event, platform, connectionId, manager)) return;
      if (handledEvents.has(event.id)) return;
      markHandled(event.id);

      if (platform === "telegram") {
        const botToken = manager.getConnectionConfigSecret(
          connectionId,
          "botToken"
        );
        if (botToken) {
          pendingQuestionOptions.set(event.id, [...event.options]);
          const optionTimer = setTimeout(() => {
            pendingQuestionOptions.delete(event.id);
            activeTimers.delete(optionTimer);
          }, PENDING_TTL);
          activeTimers.add(optionTimer);
          const buttons = event.options.map((option, i) => [
            {
              text: option,
              callback_data: `question:${event.id}:${i}`,
            },
          ]);
          const sent = await sendTelegramInlineKeyboard(
            botToken,
            event.channelId,
            event.question,
            buttons
          );
          if (sent) return;
          logger.warn(
            { connectionId },
            "Telegram inline keyboard failed for question, falling back"
          );
        }
      }

      const thread = await resolveThread(
        manager,
        connectionId,
        event.channelId,
        event.conversationId
      );
      if (!thread) return;

      const { Card, CardText, Actions, Button } = await import("chat");
      const buttons = event.options.map((option, i) =>
        Button({
          id: `question:${event.id}:${i}`,
          label: option,
          value: option,
        })
      );
      const card = Card({
        children: [CardText(event.question), Actions(buttons)],
      });
      const fallbackText = `${event.question}\n${event.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
      await postWithFallback(
        thread,
        { card, fallbackText },
        connectionId,
        "question interaction"
      );
    } catch (error) {
      logger.error(
        { connectionId, error: String(error) },
        "Unhandled error in question:created handler"
      );
    }
  };

  const redis = manager.getServices().getQueue().getRedisClient();

  const onToolApprovalNeeded = async (event: PostedToolApproval) => {
    try {
      if (!shouldHandle(event, platform, connectionId, manager)) return;
      if (handledEvents.has(event.id)) return;
      markHandled(event.id);

      const argsText = formatToolArgs(event.args);
      const text = `Tool Approval\n${event.mcpId} → ${event.toolName}\n${argsText}`;
      const tid = event.id;

      if (platform === "telegram") {
        const botToken = manager.getConnectionConfigSecret(
          connectionId,
          "botToken"
        );
        if (botToken) {
          const sent = await sendTelegramInlineKeyboard(
            botToken,
            event.channelId,
            text,
            [
              [
                { text: "Allow 1 min", callback_data: `tool:${tid}:once` },
                { text: "Allow 1h", callback_data: `tool:${tid}:1h` },
              ],
              [
                { text: "Allow 24h", callback_data: `tool:${tid}:24h` },
                {
                  text: "Allow always",
                  callback_data: `tool:${tid}:always`,
                },
              ],
              [{ text: "Deny always", callback_data: `tool:${tid}:deny` }],
            ]
          );
          if (sent) return;
          logger.warn(
            { connectionId },
            "Telegram inline keyboard failed for tool approval, falling back"
          );
        }
      }

      const thread = await resolveThread(
        manager,
        connectionId,
        event.channelId,
        event.conversationId
      );
      if (!thread) return;

      const { Card, CardText, Actions, Button } = await import("chat");
      const card = Card({
        children: [
          CardText(
            `*Tool Approval*\n${event.mcpId} → ${event.toolName}\n${argsText}`
          ),
          Actions([
            Button({
              id: `tool:${tid}:once`,
              label: "Allow 1 min",
              value: "once",
            }),
            Button({
              id: `tool:${tid}:1h`,
              label: "Allow 1h",
              style: "primary",
              value: "1h",
            }),
            Button({
              id: `tool:${tid}:24h`,
              label: "Allow 24h",
              style: "primary",
              value: "24h",
            }),
            Button({
              id: `tool:${tid}:always`,
              label: "Allow always",
              style: "primary",
              value: "always",
            }),
            Button({
              id: `tool:${tid}:deny`,
              label: "Deny always",
              style: "danger",
              value: "deny",
            }),
          ]),
        ],
      });
      await postWithFallback(
        thread,
        { card, fallbackText: text },
        connectionId,
        "tool approval interaction"
      );
    } catch (error) {
      logger.error(
        { connectionId, error: String(error) },
        "Unhandled error in tool:approval-needed handler"
      );
    }
  };

  const onLinkButtonCreated = async (event: PostedLinkButton) => {
    try {
      if (!shouldHandle(event, platform, connectionId, manager)) return;
      if (handledEvents.has(event.id)) return;
      markHandled(event.id);

      const thread = await resolveThread(
        manager,
        connectionId,
        event.channelId,
        event.conversationId
      );
      if (!thread) return;

      const { Card, CardText, Actions, LinkButton } = await import("chat");
      const linkButton = LinkButton({
        url: event.url,
        label: event.label,
      });
      const card = Card({
        children: [CardText(event.label), Actions([linkButton])],
      });
      const fallbackText = `${event.label}: ${event.url}`;
      await postWithFallback(
        thread,
        { card, fallbackText },
        connectionId,
        "link button interaction"
      );
    } catch (error) {
      logger.error(
        { connectionId, error: String(error) },
        "Unhandled error in link-button:created handler"
      );
    }
  };

  const onStatusMessageCreated = async (event: PostedStatusMessage) => {
    try {
      if (!shouldHandle(event, platform, connectionId, manager)) return;
      if (handledEvents.has(event.id)) return;
      markHandled(event.id);

      const thread = await resolveThread(
        manager,
        connectionId,
        event.channelId,
        event.conversationId
      );
      if (!thread) return;

      try {
        await thread.post(event.text);
      } catch (error) {
        logger.warn(
          { connectionId, error: String(error) },
          "Failed to post status message interaction"
        );
      }
    } catch (error) {
      logger.error(
        { connectionId, error: String(error) },
        "Unhandled error in status-message:created handler"
      );
    }
  };

  interactionService.on("question:created", onQuestionCreated);
  interactionService.on("tool:approval-needed", onToolApprovalNeeded);
  interactionService.on("link-button:created", onLinkButtonCreated);
  interactionService.on("status-message:created", onStatusMessageCreated);

  registerActionHandlers(
    chat,
    connection,
    redis,
    grantStore,
    pendingQuestionOptions,
    executeToolDirect
  );

  logger.info({ connectionId, platform }, "Interaction bridge registered");

  return () => {
    interactionService.off("question:created", onQuestionCreated);
    interactionService.off("tool:approval-needed", onToolApprovalNeeded);
    interactionService.off("link-button:created", onLinkButtonCreated);
    interactionService.off("status-message:created", onStatusMessageCreated);
    for (const timer of activeTimers) {
      clearTimeout(timer);
    }
    activeTimers.clear();
    handledEvents.clear();
    pendingQuestionOptions.clear();
    logger.info({ connectionId, platform }, "Interaction bridge unregistered");
  };
}

function registerActionHandlers(
  chat: any,
  connection: PlatformConnection,
  redis: Redis,
  grantStore: GrantStore | undefined,
  pendingQuestionOptions: Map<string, string[]>,
  executeToolDirect?: ExecuteToolDirectFn
): void {
  chat.onAction(async (event: any) => {
    const actionId: string = event.actionId ?? "";
    const value: string = event.value ?? "";
    const thread = event.thread;

    if (!thread || !actionId) return;

    // Handle tool approval — store grant, execute tool, post result
    if (actionId.startsWith("tool:")) {
      const parts = actionId.split(":");
      const requestId = parts[1];
      const decision = parts[2] ?? "deny";

      if (!requestId) return;

      if (decision === "deny") {
        if (grantStore) {
          const pending = await getPendingToolInvocation(
            redis,
            requestId
          ).catch(() => null);
          if (pending) {
            const pattern = `/mcp/${pending.mcpId}/tools/${pending.toolName}`;
            await grantStore
              .grant(pending.agentId, pattern, null, true)
              .catch(() => undefined);
          }
        }
        await redis
          .del(`${PENDING_TOOL_KEY_PREFIX}${requestId}`)
          .catch(() => undefined);
        try {
          await thread.post(
            "Tool call denied. Let me know if you'd like me to try a different approach."
          );
        } catch {
          // best effort
        }
        return;
      }

      // Approved — store grant, execute, post result
      const pending = await getPendingToolInvocation(redis, requestId).catch(
        () => null
      );
      if (!pending) {
        logger.warn(
          { requestId },
          "No pending tool invocation found — may have expired"
        );
        try {
          await thread.post("Tool approval expired. Please try again.");
        } catch {
          // best effort
        }
        return;
      }

      const pattern = `/mcp/${pending.mcpId}/tools/${pending.toolName}`;
      const expiresAt = resolveGrantExpiresAt(decision);

      if (grantStore) {
        try {
          await grantStore.grant(pending.agentId, pattern, expiresAt);
          logger.info(
            {
              requestId,
              agentId: pending.agentId,
              pattern,
              decision,
              expiresAt,
            },
            "Grant stored via tool approval"
          );
        } catch (error) {
          logger.error(
            { requestId, error: String(error) },
            "Failed to store grant"
          );
        }
      }

      // Execute the pending tool call
      if (executeToolDirect) {
        try {
          const result = await executeToolDirect(
            pending.agentId,
            pending.userId,
            pending.mcpId,
            pending.toolName,
            pending.args
          );

          const resultText = result.content.map((c) => c.text).join("\n");
          await thread.post(
            result.isError ? `Tool error: ${resultText}` : resultText
          );
          logger.info(
            {
              requestId,
              mcpId: pending.mcpId,
              toolName: pending.toolName,
              isError: result.isError,
            },
            "Tool executed after approval"
          );
        } catch (error) {
          logger.error(
            { requestId, error: String(error) },
            "Failed to execute tool after approval"
          );
          try {
            await thread.post(`Failed to execute tool: ${String(error)}`);
          } catch {
            // best effort
          }
        }
      } else {
        try {
          await thread.post("approve");
        } catch {
          // best effort
        }
      }

      await redis
        .del(`${PENDING_TOOL_KEY_PREFIX}${requestId}`)
        .catch(() => undefined);
      return;
    }

    // Handle question responses
    if (actionId.startsWith("question:")) {
      const [, questionId, optionIndex] = actionId.split(":");
      const optionIdx = Number.parseInt(optionIndex || "", 10);
      const responseText =
        value ||
        (questionId &&
        Number.isFinite(optionIdx) &&
        pendingQuestionOptions.get(questionId)?.[optionIdx]
          ? pendingQuestionOptions.get(questionId)![optionIdx]!
          : optionIndex || "");
      if (questionId) {
        pendingQuestionOptions.delete(questionId);
      }
      try {
        await thread.post(responseText);
      } catch (error) {
        logger.debug(
          { connectionId: connection.id, error: String(error) },
          "Failed to post action response"
        );
      }
    }
  });
}

function shouldHandle(
  event: { teamId?: string; channelId: string; connectionId?: string },
  platform: string,
  connectionId: string,
  manager: ChatInstanceManager
): boolean {
  if (!manager.has(connectionId)) {
    logger.debug(
      { connectionId, eventConnectionId: event.connectionId },
      "shouldHandle: manager does not have connection"
    );
    return false;
  }
  if (event.connectionId && event.connectionId !== connectionId) {
    return false;
  }
  if (event.teamId === "api") {
    logger.debug({ connectionId }, "shouldHandle: skipping api teamId");
    return false;
  }
  const instance = manager.getInstance(connectionId);
  if (!instance) {
    logger.debug({ connectionId }, "shouldHandle: no instance found");
    return false;
  }
  const matches = instance.connection.platform === platform;
  logger.debug({ connectionId, platform, matches }, "shouldHandle: result");
  if (!matches) {
    logger.debug(
      {
        connectionId,
        instancePlatform: instance.connection.platform,
        eventPlatform: platform,
      },
      "shouldHandle: platform mismatch"
    );
  }
  return matches;
}

async function resolveThread(
  manager: ChatInstanceManager,
  connectionId: string,
  channelId: string,
  conversationId: string
): Promise<any | null> {
  const instance = manager.getInstance(connectionId);
  if (!instance) {
    logger.debug({ connectionId }, "resolveThread: no instance for connection");
    return null;
  }

  try {
    const chat = instance.chat;
    const adapterKey = instance.connection.platform;

    // For DMs where conversationId === channelId, use channel directly
    // (matches resolveTarget fallback in chat-response-bridge)
    if (!conversationId || conversationId === channelId) {
      const channel = chat.channel?.(`${adapterKey}:${channelId}`);
      if (channel) return channel;
    }

    const thread = await chat.getThread?.(
      adapterKey,
      channelId,
      conversationId
    );
    if (!thread) {
      logger.debug(
        { connectionId, adapterKey, channelId, conversationId },
        "resolveThread: getThread returned null"
      );
    }
    return thread ?? null;
  } catch (error) {
    logger.debug(
      { connectionId, channelId, conversationId, error: String(error) },
      "Failed to resolve thread for interaction"
    );
    return null;
  }
}
