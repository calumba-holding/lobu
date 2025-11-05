#!/usr/bin/env bun

import { createLogger } from "@peerbot/core";
import type { Router } from "express";
import type { InteractionService } from "../../interactions";

const logger = createLogger("public-interaction-routes");

/**
 * Register public interaction HTTP routes
 * These are public endpoints for testing/automation
 */
export function registerPublicInteractionRoutes(
  router: Router,
  interactionService: InteractionService
): void {
  /**
   * Public endpoint to programmatically respond to interactions
   * POST /api/interactions/respond
   *
   * Authentication: Interaction ID itself (UUID + expiration + one-time use)
   *
   * This allows QA/testing tools to trigger interaction responses,
   * reusing the exact same code path as Slack handlers.
   */
  router.post("/api/interactions/respond", async (req: any, res: any) => {
    try {
      const { interactionId, answer, formData } = req.body;

      // Validate request
      if (!interactionId) {
        return res.status(400).json({
          error: "interactionId is required",
        });
      }

      // Validate response type
      const hasAnswer = answer !== undefined;
      const hasFormData = formData !== undefined;

      if (!hasAnswer && !hasFormData) {
        return res.status(400).json({
          error:
            "Provide either 'answer' (for radio/buttons) or 'formData' (for forms)",
        });
      }

      if (hasAnswer && hasFormData) {
        return res.status(400).json({
          error: "Provide only one: 'answer' or 'formData', not both",
        });
      }

      // Get interaction (auth via existence)
      const interaction =
        await interactionService.getInteraction(interactionId);

      if (!interaction) {
        return res.status(404).json({
          error: "Interaction not found or expired",
        });
      }

      // Validate not already responded
      if (interaction.status === "responded") {
        return res.status(400).json({
          error: "Interaction already responded to",
        });
      }

      // Validate not expired
      if (interaction.expiresAt < Date.now()) {
        return res.status(410).json({
          error: "Interaction expired",
        });
      }

      logger.info(
        `API interaction response for ${interactionId}: ${answer || "formData"}`
      );

      // REUSE THE EXACT SAME CODE PATH AS SLACK HANDLERS
      // This ensures identical behavior and testing accuracy
      await interactionService.respond(interactionId, { answer, formData });

      res.json({
        success: true,
        message: "Interaction response processed",
        interactionId: interactionId,
      });
    } catch (error) {
      logger.error("API interaction response failed:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  logger.info("✅ Public interaction routes registered");
}
