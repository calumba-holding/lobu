import { describe, expect, test } from "bun:test";
import type {
  IntegrationConfig,
  ProviderConfigEntry,
  SkillConfig,
} from "@lobu/core";
import { SystemConfigResolver } from "../services/system-config-resolver";

class MockSystemSkillsService {
  constructor(
    private readonly integrations: Record<string, IntegrationConfig>,
    private readonly providers: Record<string, ProviderConfigEntry>,
    private readonly skills: SkillConfig[]
  ) {}

  async getAllIntegrationConfigs(): Promise<Record<string, IntegrationConfig>> {
    return this.integrations;
  }

  async getProviderConfigs(): Promise<Record<string, ProviderConfigEntry>> {
    return this.providers;
  }

  async getSystemSkills(): Promise<SkillConfig[]> {
    return this.skills;
  }
}

class MockAgentSettingsStore {
  constructor(private readonly settings: Record<string, any>) {}

  async getSettings(agentId: string): Promise<any> {
    return this.settings[agentId] || null;
  }
}

describe("SystemConfigResolver integrations", () => {
  test("merges skill-declared scopes and apiDomains into integration config", async () => {
    const systemSkills = new MockSystemSkillsService(
      {
        github: {
          label: "GitHub",
          authType: "oauth",
          scopes: {
            default: ["read:user"],
            available: ["read:user", "repo"],
          },
          apiDomains: ["api.github.com"],
        },
      },
      {},
      []
    );

    const settingsStore = new MockAgentSettingsStore({
      "agent-1": {
        skillsConfig: {
          skills: [
            {
              enabled: true,
              integrations: [
                {
                  id: "github",
                  scopes: ["repo"],
                  apiDomains: ["raw.githubusercontent.com"],
                },
              ],
            },
          ],
        },
      },
    });

    const resolver = new SystemConfigResolver(
      systemSkills as any,
      settingsStore as any
    );

    const merged = await resolver.getIntegrationConfig("github", "agent-1");

    expect(merged).not.toBeNull();
    expect(merged?.scopes?.default).toEqual(["read:user", "repo"]);
    expect(merged?.apiDomains).toEqual([
      "api.github.com",
      "raw.githubusercontent.com",
    ]);
  });

  test("creates scopes block when base config has no scopes", async () => {
    const resolver = new SystemConfigResolver(
      new MockSystemSkillsService(
        {
          notion: {
            label: "Notion",
            authType: "oauth",
            apiDomains: ["api.notion.com"],
          },
        },
        {},
        []
      ) as any,
      new MockAgentSettingsStore({
        "agent-1": {
          skillsConfig: {
            skills: [
              {
                enabled: true,
                integrations: [{ id: "notion", scopes: ["pages.read"] }],
              },
            ],
          },
        },
      }) as any
    );

    const merged = await resolver.getIntegrationConfig("notion", "agent-1");

    expect(merged?.scopes).toEqual({
      default: ["pages.read"],
      available: ["pages.read"],
    });
  });
});

describe("SystemConfigResolver MCP and provider resolution", () => {
  test("builds global MCP server map and registry entries from system skills", async () => {
    const resolver = new SystemConfigResolver(
      new MockSystemSkillsService(
        {},
        {
          groq: {
            displayName: "Groq",
            iconUrl: "https://example.com/groq.png",
            envVarName: "GROQ_API_KEY",
            upstreamBaseUrl: "https://api.groq.com/openai",
            apiKeyInstructions: "Get key",
            apiKeyPlaceholder: "gsk_...",
          },
        },
        [
          {
            repo: "system/owletto",
            name: "Owletto",
            enabled: true,
            description: "Memory MCP",
            mcpServers: [
              {
                id: "owletto",
                name: "Owletto",
                url: "https://owletto.com/mcp",
              },
              { id: "local-tool", command: "mcp-local", args: ["--stdio"] },
            ],
          } as SkillConfig,
        ]
      ) as any
    );

    const globalMcp = await resolver.getGlobalMcpServers();
    const registryEntries = await resolver.getMcpRegistryServers();
    const providers = await resolver.getProviderConfigs();

    expect(globalMcp.owletto).toEqual({
      type: "sse",
      url: "https://owletto.com/mcp",
    });
    expect(globalMcp["local-tool"]).toEqual({
      type: "stdio",
      command: "mcp-local",
      args: ["--stdio"],
    });

    expect(registryEntries.map((entry) => entry.id)).toEqual([
      "owletto",
      "local-tool",
    ]);
    expect(registryEntries[1]?.type).toBe("command");

    expect(Object.keys(providers)).toEqual(["groq"]);
  });
});
