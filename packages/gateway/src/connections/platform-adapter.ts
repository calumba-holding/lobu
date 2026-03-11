import { createLogger } from "@lobu/core";
import type { CoreServices, PlatformAdapter } from "../platform";
import type { ChatInstanceManager } from "./chat-instance-manager";
import type { PlatformAdapterConfig, PlatformConnection } from "./types";

const logger = createLogger("chat-platform-adapter");

const ENV_BOOTSTRAP_AGENT_IDS = {
  slack: "system:connection:slack",
  telegram: "system:connection:telegram",
  whatsapp: "system:connection:whatsapp",
} as const;

type HistoryRecord = {
  role: "user" | "assistant";
  content: string;
  authorName?: string;
  timestamp: number;
};

export class ChatPlatformAdapter implements PlatformAdapter {
  constructor(
    public readonly name: "slack" | "telegram" | "whatsapp",
    private manager: ChatInstanceManager | null
  ) {}

  setManager(manager: ChatInstanceManager): void {
    this.manager = manager;
  }

  async initialize(_services: CoreServices): Promise<void> {
    // no-op: lifecycle managed by ChatInstanceManager
  }

  async start(): Promise<void> {
    // no-op: lifecycle managed by ChatInstanceManager
  }

  async stop(): Promise<void> {
    // no-op: lifecycle managed by ChatInstanceManager
  }

  isHealthy(): boolean {
    return true;
  }

  buildDeploymentMetadata(
    conversationId: string,
    channelId: string,
    platformMetadata: Record<string, any>
  ): Record<string, string> {
    return {
      platform: this.name,
      channelId,
      conversationId,
      ...(typeof platformMetadata.connectionId === "string"
        ? { connectionId: platformMetadata.connectionId }
        : {}),
    };
  }

  extractRoutingInfo(body: Record<string, unknown>): {
    channelId: string;
    conversationId?: string;
    teamId?: string;
  } | null {
    if (this.name === "slack") {
      const slack = body.slack as
        | { channel?: string; thread?: string; team?: string }
        | undefined;
      if (!slack?.channel) return null;
      return {
        channelId: slack.channel,
        conversationId: slack.thread,
        teamId: slack.team,
      };
    }

    if (this.name === "telegram") {
      const telegram = body.telegram as
        | { chatId?: string | number }
        | undefined;
      if (!telegram?.chatId) return null;
      return {
        channelId: String(telegram.chatId),
        conversationId: String(telegram.chatId),
      };
    }

    const whatsapp = body.whatsapp as { chat?: string } | undefined;
    if (!whatsapp?.chat) return null;
    return {
      channelId: whatsapp.chat,
      conversationId: whatsapp.chat,
    };
  }

  async sendMessage(
    _token: string,
    message: string,
    options: {
      agentId: string;
      channelId: string;
      conversationId?: string;
      teamId: string;
      files?: Array<{ buffer: Buffer; filename: string }>;
    }
  ): Promise<{
    messageId: string;
    eventsUrl?: string;
    queued?: boolean;
  }> {
    if (!this.manager) {
      throw new Error(`Platform "${this.name}" is not initialized`);
    }
    if (options.files?.length) {
      throw new Error(
        `Platform "${this.name}" does not support file uploads via Chat SDK routing yet`
      );
    }

    const connection = await this.selectConnection(
      options.channelId,
      options.teamId
    );
    if (!connection) {
      throw new Error(`No active ${this.name} connection is available`);
    }

    const instance = this.manager.getInstance(connection.id);
    if (!instance) {
      throw new Error(`Connection ${connection.id} is not running`);
    }

    const content =
      this.name === "slack" ? message : message.replace(/@me\s*/g, "").trim();
    if (!content) {
      throw new Error("Cannot send an empty message");
    }

    let sent;
    if (options.conversationId) {
      const adapter = instance.chat.getAdapter?.(connection.platform);
      const createThread = (instance.chat as any).createThread;
      const threadId = `${connection.platform}:${options.channelId}:${options.conversationId}`;
      const thread =
        adapter && typeof createThread === "function"
          ? await createThread.call(instance.chat, adapter, threadId, {}, false)
          : null;
      if (!thread) {
        throw new Error(`Unable to resolve ${this.name} thread`);
      }
      sent = await thread.post(content);
    } else {
      const channel = instance.chat.channel?.(
        `${connection.platform}:${options.channelId}`
      );
      if (!channel) {
        throw new Error(`Unable to resolve ${this.name} channel`);
      }
      sent = await channel.post(content);
    }

    return {
      messageId: String(sent?.id || sent?.messageId || sent?.ts || Date.now()),
    };
  }

  async getConversationHistory(
    channelId: string,
    _conversationId: string | undefined,
    limit: number,
    before: string | undefined
  ): Promise<{
    messages: Array<{
      timestamp: string;
      user: string;
      text: string;
      isBot?: boolean;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.manager) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const connection = await this.selectConnection(channelId);
    if (!connection) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const redis = this.manager.getServices().getQueue().getRedisClient();
    const key = `chat:history:${connection.id}:${channelId}`;
    const raw = await redis.lrange(key, 0, -1);
    let entries = raw.map(
      (entry: string) => JSON.parse(entry) as HistoryRecord
    );

    if (before) {
      const cutoff = Date.parse(before);
      if (!Number.isNaN(cutoff)) {
        entries = entries.filter(
          (entry: HistoryRecord) => entry.timestamp < cutoff
        );
      }
    }

    const hasMore = entries.length > limit;
    const selected = entries.slice(-limit);
    const nextCursor =
      hasMore && selected[0]
        ? new Date(selected[0].timestamp).toISOString()
        : null;

    return {
      messages: selected.map((entry: HistoryRecord) => ({
        timestamp: new Date(entry.timestamp).toISOString(),
        user:
          entry.authorName ||
          (entry.role === "assistant" ? "assistant" : "user"),
        text: entry.content,
        isBot: entry.role === "assistant",
      })),
      nextCursor,
      hasMore,
    };
  }

  private async selectConnection(
    channelId: string,
    teamId?: string
  ): Promise<PlatformConnection | null> {
    if (!this.manager) return null;

    const connections = await this.manager.listConnections({
      platform: this.name,
    });
    const activeConnections = connections.filter((connection) =>
      this.manager?.has(connection.id)
    );
    if (activeConnections.length === 0) return null;
    if (activeConnections.length === 1) return activeConnections[0] || null;

    const teamMatch = activeConnections.find(
      (connection) => connection.metadata?.teamId === teamId
    );
    if (teamMatch) return teamMatch;

    const redis = this.manager.getServices().getQueue().getRedisClient();
    for (const connection of activeConnections) {
      const exists = await redis.exists(
        `chat:history:${connection.id}:${channelId}`
      );
      if (exists === 1) {
        return connection;
      }
    }

    return activeConnections[0] || null;
  }
}

async function ensureBootstrapConnection(
  manager: ChatInstanceManager,
  platform: keyof typeof ENV_BOOTSTRAP_AGENT_IDS,
  config: PlatformAdapterConfig
): Promise<void> {
  const agentId = ENV_BOOTSTRAP_AGENT_IDS[platform];
  const existing = await manager.listConnections({ agentId });
  const alreadyBootstrapped = existing.find(
    (connection) => connection.platform === platform
  );
  if (alreadyBootstrapped) {
    return;
  }

  const created = await manager.addConnection(platform, agentId, config, {
    allowGroups: true,
  });
  logger.info(
    { connectionId: created.id, platform },
    "Bootstrapped platform connection from environment"
  );
}

export async function bootstrapConnectionsFromEnv(
  manager: ChatInstanceManager
): Promise<void> {
  const publicGatewayUrl = process.env.PUBLIC_GATEWAY_URL;
  const useWebhook = (() => {
    if (!publicGatewayUrl) return false;
    try {
      const host = new URL(publicGatewayUrl).hostname;
      return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
    } catch {
      return false;
    }
  })();

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken) {
    await ensureBootstrapConnection(manager, "telegram", {
      platform: "telegram",
      botToken: telegramToken,
      mode: useWebhook ? "webhook" : "polling",
      ...(process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN
        ? { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN }
        : {}),
      ...(process.env.TELEGRAM_BOT_USERNAME
        ? { userName: process.env.TELEGRAM_BOT_USERNAME }
        : {}),
    });
  }

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (slackBotToken) {
    await ensureBootstrapConnection(manager, "slack", {
      platform: "slack",
      botToken: slackBotToken,
      ...(process.env.SLACK_SIGNING_SECRET
        ? { signingSecret: process.env.SLACK_SIGNING_SECRET }
        : {}),
      ...(process.env.SLACK_CLIENT_ID
        ? { clientId: process.env.SLACK_CLIENT_ID }
        : {}),
      ...(process.env.SLACK_CLIENT_SECRET
        ? { clientSecret: process.env.SLACK_CLIENT_SECRET }
        : {}),
      ...(process.env.SLACK_ENCRYPTION_KEY
        ? { encryptionKey: process.env.SLACK_ENCRYPTION_KEY }
        : {}),
    });
  }

  const whatsappCloudConfig = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  };
  if (
    whatsappCloudConfig.accessToken &&
    whatsappCloudConfig.appSecret &&
    whatsappCloudConfig.phoneNumberId &&
    whatsappCloudConfig.verifyToken
  ) {
    await ensureBootstrapConnection(manager, "whatsapp", {
      platform: "whatsapp",
      accessToken: whatsappCloudConfig.accessToken,
      appSecret: whatsappCloudConfig.appSecret,
      phoneNumberId: whatsappCloudConfig.phoneNumberId,
      verifyToken: whatsappCloudConfig.verifyToken,
      userName: process.env.WHATSAPP_BOT_NAME || "lobu-whatsapp",
      logger: console as any,
    });
  } else if (process.env.WHATSAPP_CREDENTIALS) {
    logger.warn(
      "WHATSAPP_CREDENTIALS is configured, but Chat SDK bootstrapping requires WhatsApp Cloud API credentials"
    );
  }
}
