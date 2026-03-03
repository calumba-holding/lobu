import type { IntegrationConfig, ProviderConfigEntry } from "@lobu/core";
import { normalizeSkillIntegration } from "@lobu/core";
import type { SystemSkillsService } from "../../services/system-skills-service";
import type { AgentSettingsStore } from "../settings/agent-settings-store";

export class IntegrationConfigService {
  private systemSkillsService: SystemSkillsService;
  private agentSettingsStore?: AgentSettingsStore;

  constructor(
    systemSkillsService: SystemSkillsService,
    agentSettingsStore?: AgentSettingsStore
  ) {
    this.systemSkillsService = systemSkillsService;
    this.agentSettingsStore = agentSettingsStore;
  }

  async getAll(): Promise<Record<string, IntegrationConfig>> {
    const configs = await this.systemSkillsService.getAllIntegrationConfigs();
    for (const config of Object.values(configs)) {
      if (!config.authType) config.authType = "oauth";
    }
    return configs;
  }

  async getIntegration(
    id: string,
    agentId?: string
  ): Promise<IntegrationConfig | null> {
    const all = await this.getAll();
    const config = all[id] ?? null;
    if (!config || !agentId) return config;

    const skillScopes = await this.getSkillScopesForIntegration(agentId, id);
    if (
      skillScopes.scopes.length === 0 &&
      skillScopes.apiDomains.length === 0
    ) {
      return config;
    }

    const merged = { ...config };
    if (skillScopes.scopes.length > 0 && merged.scopes) {
      const existing = new Set(merged.scopes.default || []);
      const added = skillScopes.scopes.filter((s) => !existing.has(s));
      if (added.length > 0) {
        merged.scopes = {
          ...merged.scopes,
          default: [...merged.scopes.default, ...added],
        };
      }
    } else if (skillScopes.scopes.length > 0) {
      merged.scopes = {
        default: skillScopes.scopes,
        available: skillScopes.scopes,
      };
    }
    if (skillScopes.apiDomains.length > 0) {
      const existing = new Set(merged.apiDomains || []);
      const added = skillScopes.apiDomains.filter((d) => !existing.has(d));
      if (added.length > 0) {
        merged.apiDomains = [...(merged.apiDomains || []), ...added];
      }
    }
    return merged;
  }

  async getSkillScopesForIntegration(
    agentId: string,
    integrationId: string
  ): Promise<{ scopes: string[]; apiDomains: string[] }> {
    if (!this.agentSettingsStore) return { scopes: [], apiDomains: [] };
    const settings = await this.agentSettingsStore.getSettings(agentId);
    if (!settings?.skillsConfig?.skills) return { scopes: [], apiDomains: [] };

    const allScopes = new Set<string>();
    const allDomains = new Set<string>();
    for (const skill of settings.skillsConfig.skills) {
      if (!skill.enabled || !skill.integrations) continue;
      for (const raw of skill.integrations) {
        const ig = normalizeSkillIntegration(raw);
        if (ig.id !== integrationId) continue;
        if (ig.scopes) for (const s of ig.scopes) allScopes.add(s);
        if (ig.apiDomains) for (const d of ig.apiDomains) allDomains.add(d);
      }
    }
    return { scopes: [...allScopes], apiDomains: [...allDomains] };
  }

  async getProviders(): Promise<Record<string, ProviderConfigEntry>> {
    return this.systemSkillsService.getProviderConfigs();
  }
}
