#!/usr/bin/env bun

/**
 * API Platform Adapter
 * Handles direct API access for browser extensions, CLI clients, etc.
 * Does not require external platform integration (no Slack, Discord, etc.)
 */

import { createLogger, type InstructionProvider, type UserInteraction } from "@peerbot/core";
import type { CoreServices, PlatformAdapter } from "../platform";
import { ApiResponseRenderer } from "./response-renderer";
import type { ResponseRenderer } from "../platform/response-renderer";
import { broadcastToSession } from "../routes/public/sessions";

const logger = createLogger("api-platform");

/**
 * API Platform configuration
 */
export interface ApiPlatformConfig {
  /** Whether the API platform is enabled */
  enabled?: boolean;
}

/**
 * API Platform adapter for direct access via HTTP/SSE
 * This platform doesn't interact with external services like Slack or Discord.
 * Instead, it provides endpoints for:
 * - Creating sessions
 * - Sending messages
 * - Receiving streaming responses via SSE
 * - Handling tool approvals
 */
export class ApiPlatform implements PlatformAdapter {
  readonly name = "api";

  private services?: CoreServices;
  private responseRenderer?: ApiResponseRenderer;
  private isRunning = false;

  constructor(private readonly config: ApiPlatformConfig = {}) {}

  /**
   * Initialize with core services
   */
  async initialize(services: CoreServices): Promise<void> {
    logger.info("Initializing API platform...");
    this.services = services;

    // Create response renderer for routing worker responses to SSE clients
    this.responseRenderer = new ApiResponseRenderer();

    // Subscribe to interaction events to handle tool approvals
    const interactionService = services.getInteractionService();
    interactionService.on("interaction:created", (interaction) => {
      // Only handle API platform interactions
      if (interaction.teamId === "api" || interaction.spaceId?.startsWith("api-")) {
        this.handleToolApproval(interaction).catch((error) => {
          logger.error("Failed to handle tool approval:", error);
        });
      }
    });

    logger.info("✅ API platform initialized");
  }

  /**
   * Start the platform
   * For API platform, this is mostly a no-op since routes are registered separately
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info("✅ API platform started");
  }

  /**
   * Stop the platform
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info("✅ API platform stopped");
  }

  /**
   * Check if platform is healthy
   */
  isHealthy(): boolean {
    return this.isRunning;
  }

  /**
   * No custom instruction provider for API platform
   */
  getInstructionProvider(): InstructionProvider | null {
    return null;
  }

  /**
   * Build deployment metadata
   * For API sessions, we include session ID and source
   */
  buildDeploymentMetadata(
    threadId: string,
    channelId: string,
    platformMetadata: Record<string, any>
  ): Record<string, string> {
    return {
      sessionId: platformMetadata.sessionId || threadId,
      source: "direct-api",
      channelId,
    };
  }

  /**
   * Get the response renderer for routing worker responses
   */
  getResponseRenderer(): ResponseRenderer | undefined {
    return this.responseRenderer;
  }

  /**
   * Handle tool approval requests by sending them via SSE
   */
  private async handleToolApproval(interaction: UserInteraction): Promise<void> {
    const sessionId = interaction.threadId;
    if (!sessionId) {
      logger.warn("No session ID found for tool approval interaction");
      return;
    }

    // Send tool approval request to SSE clients
    broadcastToSession(sessionId, "tool_approval", {
      type: "tool_approval",
      interactionId: interaction.id,
      title: interaction.title,
      message: interaction.message,
      fields: interaction.fields,
      buttons: interaction.buttons,
      expiresAt: interaction.expiresAt,
      timestamp: Date.now(),
    });

    logger.info(`Sent tool approval to session ${sessionId}: ${interaction.id}`);
  }

  /**
   * API platform doesn't render interactions via platform UI
   * Instead, interactions are sent via SSE to the client
   */
  async renderInteraction(): Promise<void> {
    // Interactions are handled via SSE in the response renderer
  }

  /**
   * API platform doesn't render suggestions via platform UI
   */
  async renderSuggestion(): Promise<void> {
    // Suggestions are handled via SSE in the response renderer
  }

  /**
   * API platform doesn't have thread status indicators
   */
  async setThreadStatus(): Promise<void> {
    // Status is sent via SSE events
  }
}
