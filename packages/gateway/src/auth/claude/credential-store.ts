import { createLogger } from "@peerbot/core";
import type Redis from "ioredis";

const logger = createLogger("claude-credential-store");

export interface ClaudeCredentials {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp in milliseconds
  scopes: string[];
}

/**
 * Store and retrieve Claude OAuth credentials from Redis
 * Pattern: claude:credential:{userId}
 */
export class ClaudeCredentialStore {
  constructor(private redis: Redis) {}

  /**
   * Store Claude credentials for a user
   */
  async setCredentials(
    userId: string,
    credentials: ClaudeCredentials
  ): Promise<void> {
    const key = this.getKey(userId);

    await this.redis.set(key, JSON.stringify(credentials));

    logger.info(`Stored Claude credentials for user ${userId}`, {
      expiresAt: new Date(credentials.expiresAt).toISOString(),
      scopes: credentials.scopes,
    });
  }

  /**
   * Get Claude credentials for a user
   * Returns null if not found or if credentials are missing required fields
   */
  async getCredentials(userId: string): Promise<ClaudeCredentials | null> {
    const key = this.getKey(userId);
    const data = await this.redis.get(key);

    if (!data) {
      logger.debug(`No Claude credentials found for user ${userId}`);
      return null;
    }

    try {
      const credentials = JSON.parse(data) as ClaudeCredentials;

      // Validate required fields
      if (!credentials.accessToken) {
        logger.warn(
          `Invalid credentials for user ${userId}: missing accessToken`
        );
        return null;
      }

      return credentials;
    } catch (error) {
      logger.error(`Failed to parse Claude credentials for user ${userId}`, {
        error,
      });
      return null;
    }
  }

  /**
   * Delete Claude credentials for a user
   */
  async deleteCredentials(userId: string): Promise<void> {
    const key = this.getKey(userId);
    await this.redis.del(key);
    logger.info(`Deleted Claude credentials for user ${userId}`);
  }

  /**
   * Check if user has Claude credentials
   */
  async hasCredentials(userId: string): Promise<boolean> {
    const credentials = await this.getCredentials(userId);
    return credentials !== null;
  }

  private getKey(userId: string): string {
    return `claude:credential:${userId}`;
  }
}
