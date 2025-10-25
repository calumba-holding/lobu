import { createLogger } from "@peerbot/core";
import type Redis from "ioredis";

const logger = createLogger("claude-model-service");

export interface ClaudeModel {
  id: string;
  display_name: string;
  created_at: string;
  type: string;
}

interface ModelsResponse {
  data: ClaudeModel[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

/**
 * Service to fetch and cache available Claude models from Anthropic API
 */
export class ClaudeModelService {
  private static readonly CACHE_KEY = "claude:available_models";
  private static readonly CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
  private static readonly API_VERSION = "2023-06-01";

  constructor(
    private redis: Redis,
    private systemApiKey?: string
  ) {}

  /**
   * Get available models from cache or API
   */
  async getAvailableModels(): Promise<ClaudeModel[]> {
    // Try cache first
    const cached = await this.redis.get(ClaudeModelService.CACHE_KEY);
    if (cached) {
      try {
        const models = JSON.parse(cached) as ClaudeModel[];
        logger.info(`Retrieved ${models.length} models from cache`);
        return models;
      } catch (error) {
        logger.warn("Failed to parse cached models", { error });
      }
    }

    // Fetch from API
    logger.info("Fetching models from Anthropic API");
    const models = await this.fetchModelsFromAPI();

    // Cache the results
    if (models.length > 0) {
      await this.redis.setex(
        ClaudeModelService.CACHE_KEY,
        ClaudeModelService.CACHE_TTL_SECONDS,
        JSON.stringify(models)
      );
      logger.info(
        `Cached ${models.length} models for ${ClaudeModelService.CACHE_TTL_SECONDS}s`
      );
    }

    return models;
  }

  /**
   * Fetch models from Anthropic API
   */
  private async fetchModelsFromAPI(): Promise<ClaudeModel[]> {
    if (!this.systemApiKey) {
      logger.warn("No system API key available, cannot fetch models");
      return [];
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": this.systemApiKey,
          "anthropic-version": ClaudeModelService.API_VERSION,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        logger.error(
          `Failed to fetch models: ${response.status} ${response.statusText}`
        );
        return [];
      }

      const data = (await response.json()) as ModelsResponse;

      if (!data.data || !Array.isArray(data.data)) {
        logger.error("Invalid response format from models API");
        return [];
      }

      // Filter to only Claude models (exclude experimental/beta models if needed)
      const claudeModels = data.data.filter((model) =>
        model.id.startsWith("claude-")
      );

      logger.info(`Fetched ${claudeModels.length} Claude models from API`);

      return claudeModels;
    } catch (error) {
      logger.error("Error fetching models from API", { error });
      return [];
    }
  }

  /**
   * Refresh the model cache
   */
  async refreshCache(): Promise<void> {
    logger.info("Manually refreshing model cache");
    await this.redis.del(ClaudeModelService.CACHE_KEY);
    await this.getAvailableModels();
  }
}
