#!/usr/bin/env bun

import { createLogger, verifyWorkerToken } from "@lobu/core";
import { Hono } from "hono";
import { platformRegistry } from "../../platform";

const logger = createLogger("history-routes");

type WorkerContext = {
  Variables: {
    worker: {
      conversationId: string;
      channelId: string;
      platform: string;
      teamId: string;
    };
  };
};

/**
 * Create internal history routes (Hono)
 * Provides channel history to workers via MCP tool
 */
export function createHistoryRoutes(): Hono<WorkerContext> {
  const router = new Hono<WorkerContext>();

  // Worker authentication middleware
  const authenticateWorker = async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid authorization" }, 401);
    }
    const workerToken = authHeader.substring(7);
    const tokenData = verifyWorkerToken(workerToken);
    if (!tokenData) {
      return c.json({ error: "Invalid worker token" }, 401);
    }
    c.set("worker", tokenData);
    await next();
  };

  /**
   * Get channel history
   * GET /history?platform=slack&channelId=xxx&conversationId=xxx&limit=50&before=timestamp
   */
  router.get("/history", authenticateWorker, async (c) => {
    try {
      const worker = c.get("worker");
      const platform = c.req.query("platform") || worker.platform || "api";
      const channelId = c.req.query("channelId") || worker.channelId;
      const conversationId =
        c.req.query("conversationId") || worker.conversationId;
      const limitStr = c.req.query("limit") || "50";
      const before = c.req.query("before"); // ISO timestamp cursor

      const limit = Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 100);

      if (!channelId) {
        return c.json({ error: "Missing channelId parameter" }, 400);
      }

      logger.info(`Fetching history for ${platform}/${channelId}`, {
        conversationId,
        limit,
        before,
      });

      const platformAdapter = platformRegistry.get(platform);
      if (platformAdapter?.getConversationHistory) {
        const response = await platformAdapter.getConversationHistory(
          channelId,
          conversationId,
          limit,
          before
        );
        return c.json(response);
      }

      return c.json({
        messages: [],
        nextCursor: null,
        hasMore: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to fetch history: ${message}`);
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
