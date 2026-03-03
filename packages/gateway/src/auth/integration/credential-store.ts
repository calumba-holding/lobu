import type { IntegrationCredentialRecord } from "@lobu/core";
import { BaseCredentialStore } from "@lobu/core";
import type Redis from "ioredis";

/**
 * Integration credential store with scope tracking.
 * Key format: integration:credential:{agentId}:{integrationId}:{accountId}
 * No TTL — preserves refresh tokens for long-lived connections.
 */
export class IntegrationCredentialStore extends BaseCredentialStore<IntegrationCredentialRecord> {
  constructor(redis: Redis) {
    super({
      redis,
      keyPrefix: "integration:credential",
      loggerName: "integration-credentials",
    });
  }

  async getCredentials(
    agentId: string,
    integrationId: string,
    accountId = "default"
  ): Promise<IntegrationCredentialRecord | null> {
    const key = this.buildKey(agentId, integrationId, accountId);
    return this.get(key);
  }

  async setCredentials(
    agentId: string,
    integrationId: string,
    record: IntegrationCredentialRecord,
    accountId = "default"
  ): Promise<void> {
    const key = this.buildKey(agentId, integrationId, accountId);
    await this.set(key, record);
  }

  async deleteCredentials(
    agentId: string,
    integrationId: string,
    accountId = "default"
  ): Promise<void> {
    const key = this.buildKey(agentId, integrationId, accountId);
    await this.delete(key);
  }

  async listAccounts(
    agentId: string,
    integrationId: string
  ): Promise<
    Array<{ accountId: string; credentials: IntegrationCredentialRecord }>
  > {
    const prefix = this.buildKey(agentId, integrationId);
    const keys = await this.scanByPrefix(`${prefix}:`);
    const results: Array<{
      accountId: string;
      credentials: IntegrationCredentialRecord;
    }> = [];

    for (const key of keys) {
      // Key format: integration:credential:{agentId}:{integrationId}:{accountId}
      // Extract accountId from the last segment
      const accountId = key.substring(prefix.length + 1);
      if (!accountId) continue;

      const credentials = await this.get(key);
      if (credentials) {
        results.push({ accountId, credentials });
      }
    }

    return results;
  }
}
