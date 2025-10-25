#!/usr/bin/env bun

import {
  createLogger,
  type InstructionContext,
  type InstructionProvider,
} from "@peerbot/core";
import type { McpConfigService } from "../auth/mcp/config-service";

const logger = createLogger("instruction-service");

export interface McpStatus {
  id: string;
  name: string;
  requiresAuth: boolean;
  requiresInput: boolean;
  authenticated: boolean;
  configured: boolean;
}

export interface SessionContextData {
  platformInstructions: string;
  mcpStatus: McpStatus[];
}

/**
 * Aggregates session context data for workers
 * Returns raw data (not built instructions) so workers can format as needed
 */
export class InstructionService {
  private platformProviders = new Map<string, InstructionProvider>();
  private mcpConfigService?: McpConfigService;

  constructor(mcpConfigService?: McpConfigService) {
    this.mcpConfigService = mcpConfigService;
  }

  /**
   * Register a platform-specific instruction provider
   * Called by platform adapters during initialization
   */
  registerPlatformProvider(
    platform: string,
    provider: InstructionProvider
  ): void {
    this.platformProviders.set(platform, provider);
    logger.info(
      `Registered instruction provider for platform: ${platform} (${provider.name})`
    );
  }

  /**
   * Get session context data for a worker
   * Returns platform instructions and MCP status data
   * Worker will build final instructions from this data
   */
  async getSessionContext(
    platform: string,
    context: InstructionContext
  ): Promise<SessionContextData> {
    // Get platform-specific instructions
    let platformInstructions = "";
    const platformProvider = this.platformProviders.get(platform);
    if (platformProvider) {
      try {
        platformInstructions = await platformProvider.getInstructions(context);
        logger.info(
          `Got ${platform} platform instructions (${platformInstructions.length} chars)`
        );
      } catch (error) {
        logger.error(
          `Failed to get instructions from ${platform} provider:`,
          error
        );
      }
    }

    // Get MCP status data
    let mcpStatus: McpStatus[] = [];
    if (this.mcpConfigService) {
      try {
        mcpStatus =
          (await this.mcpConfigService.getMcpStatus(context.userId)) || [];
        logger.info(`Got MCP status for ${mcpStatus.length} MCPs`);
      } catch (error) {
        logger.error("Failed to get MCP status:", error);
      }
    }

    return {
      platformInstructions,
      mcpStatus,
    };
  }
}
