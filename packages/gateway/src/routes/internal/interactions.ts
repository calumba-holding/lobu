#!/usr/bin/env bun

import { createLogger } from "@peerbot/core";
import type { Router } from "express";
import type { InteractionService } from "../../interactions";

const logger = createLogger("internal-interaction-routes");

/**
 * Register internal interaction HTTP routes
 * These are internal routes called by workers
 */
export function registerInternalInteractionRoutes(
  router: Router,
  interactionService: InteractionService,
  authenticateWorker: any
): void {
  /**
   * Create a blocking interaction
   * POST /internal/interactions/create
   * Response is delivered to worker via SSE, not polling
   */
  router.post(
    "/internal/interactions/create",
    authenticateWorker,
    async (req: any, res: any) => {
      try {
        const { userId, threadId, channelId, teamId } = req.worker;
        const { interactionType, question, options, metadata } = req.body;

        if (!interactionType) {
          return res.status(400).json({ error: "interactionType is required" });
        }

        logger.info(
          `Creating ${interactionType} interaction for thread ${threadId}`
        );

        const interaction = await interactionService.createInteraction(
          userId,
          threadId,
          channelId,
          teamId,
          {
            interactionType,
            question,
            options,
            metadata,
          }
        );

        // Return interaction ID - worker will wait for response via SSE
        res.json({ id: interaction.id });
      } catch (error) {
        logger.error("Failed to create interaction:", error);
        res.status(500).json({ error: "Failed to create interaction" });
      }
    }
  );

  /**
   * Create non-blocking suggestions (one-off, replaces previous)
   * POST /internal/suggestions/create
   */
  router.post(
    "/internal/suggestions/create",
    authenticateWorker,
    async (req: any, res: any) => {
      try {
        const { userId, threadId, channelId, teamId } = req.worker;
        const { prompts } = req.body;

        logger.info(
          `Sending suggestions to thread ${threadId} (${prompts.length} prompts)`
        );

        await interactionService.createSuggestion(
          userId,
          threadId,
          channelId,
          teamId,
          prompts
        );

        res.json({ success: true });
      } catch (error) {
        logger.error("Failed to send suggestions:", error);
        res.status(500).json({ error: "Failed to send suggestions" });
      }
    }
  );

  logger.info("✅ Internal interaction routes registered");
}
