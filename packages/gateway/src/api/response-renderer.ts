#!/usr/bin/env bun

/**
 * API Response Renderer
 * Broadcasts worker responses to SSE connections for direct API clients
 */

import { createLogger } from "@peerbot/core";
import type { ThreadResponsePayload } from "../infrastructure/queue/types";
import type { ResponseRenderer } from "../platform/response-renderer";
import { broadcastToSession } from "../routes/public/sessions";

const logger = createLogger("api-response-renderer");

/**
 * Response renderer for API platform
 * Broadcasts responses to SSE clients instead of external platforms
 */
export class ApiResponseRenderer implements ResponseRenderer {
  /**
   * Handle streaming delta content
   * Broadcasts delta to SSE connections
   */
  async handleDelta(
    payload: ThreadResponsePayload,
    sessionKey: string
  ): Promise<string | null> {
    // Extract session ID from platformMetadata or thread ID
    const sessionId =
      (payload.platformMetadata?.sessionId as string) || payload.threadId;

    if (!sessionId) {
      logger.warn("No session ID found in payload for delta broadcast");
      return null;
    }

    // Broadcast delta to SSE clients
    broadcastToSession(sessionId, "output", {
      type: "delta",
      content: payload.delta,
      timestamp: payload.timestamp || Date.now(),
      messageId: payload.messageId,
    });

    logger.debug(
      `Broadcast delta to session ${sessionId}: ${payload.delta?.length || 0} chars`
    );

    return payload.messageId;
  }

  /**
   * Handle completion of response processing
   * Sends completion event to SSE clients
   */
  async handleCompletion(
    payload: ThreadResponsePayload,
    sessionKey: string
  ): Promise<void> {
    const sessionId =
      (payload.platformMetadata?.sessionId as string) || payload.threadId;

    if (!sessionId) {
      logger.warn("No session ID found in payload for completion broadcast");
      return;
    }

    // Broadcast completion to SSE clients
    broadcastToSession(sessionId, "complete", {
      type: "complete",
      messageId: payload.messageId,
      processedMessageIds: payload.processedMessageIds,
      timestamp: payload.timestamp || Date.now(),
    });

    logger.info(`Broadcast completion to session ${sessionId}`);
  }

  /**
   * Handle error response
   * Sends error event to SSE clients
   */
  async handleError(
    payload: ThreadResponsePayload,
    sessionKey: string
  ): Promise<void> {
    const sessionId =
      (payload.platformMetadata?.sessionId as string) || payload.threadId;

    if (!sessionId) {
      logger.warn("No session ID found in payload for error broadcast");
      return;
    }

    // Broadcast error to SSE clients
    broadcastToSession(sessionId, "error", {
      type: "error",
      error: payload.error,
      messageId: payload.messageId,
      timestamp: payload.timestamp || Date.now(),
    });

    logger.error(`Broadcast error to session ${sessionId}: ${payload.error}`);
  }

  /**
   * Handle status updates (heartbeat with elapsed time)
   * Sends status event to SSE clients
   */
  async handleStatusUpdate(payload: ThreadResponsePayload): Promise<void> {
    const sessionId =
      (payload.platformMetadata?.sessionId as string) || payload.threadId;

    if (!sessionId) {
      return;
    }

    // Broadcast status to SSE clients
    broadcastToSession(sessionId, "status", {
      type: "status",
      status: payload.statusUpdate,
      messageId: payload.messageId,
      timestamp: payload.timestamp || Date.now(),
    });
  }

  /**
   * Handle ephemeral messages
   * For API platform, these are just broadcast as regular events
   */
  async handleEphemeral(payload: ThreadResponsePayload): Promise<void> {
    const sessionId =
      (payload.platformMetadata?.sessionId as string) || payload.threadId;

    if (!sessionId) {
      return;
    }

    // Broadcast ephemeral content to SSE clients
    broadcastToSession(sessionId, "ephemeral", {
      type: "ephemeral",
      content: payload.content,
      messageId: payload.messageId,
      timestamp: payload.timestamp || Date.now(),
    });
  }

  /**
   * Stop stream for thread - no-op for API platform
   * SSE connections handle their own lifecycle
   */
  async stopStreamForThread(_userId: string, _threadId: string): Promise<void> {
    // No-op - SSE connections manage their own lifecycle
  }
}
