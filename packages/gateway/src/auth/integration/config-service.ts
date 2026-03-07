import type { IntegrationConfig, ProviderConfigEntry } from "@lobu/core";
import type { SystemConfigResolver } from "../../services/system-config-resolver";

export class IntegrationConfigService {
  constructor(private readonly resolver: SystemConfigResolver) {}

  async getAll(): Promise<Record<string, IntegrationConfig>> {
    return this.resolver.getIntegrationConfigs();
  }

  async getIntegration(
    id: string,
    agentId?: string
  ): Promise<IntegrationConfig | null> {
    return this.resolver.getIntegrationConfig(id, agentId);
  }

  async getSkillScopesForIntegration(
    agentId: string,
    integrationId: string
  ): Promise<{ scopes: string[]; apiDomains: string[] }> {
    return this.resolver.getSkillScopesForIntegration(agentId, integrationId);
  }

  async getProviders(): Promise<Record<string, ProviderConfigEntry>> {
    return this.resolver.getProviderConfigs();
  }
}
