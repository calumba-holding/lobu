import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  hidden?: boolean;
  mcpServers?: Array<{
    id: string;
    name?: string;
    url?: string;
    type?: string;
    command?: string;
    args?: string[];
  }>;
  nixPackages?: string[];
  permissions?: string[];
  providers?: Array<{
    displayName: string;
    envVarName: string;
    upstreamBaseUrl: string;
    defaultModel?: string;
    apiKeyInstructions?: string;
    modelsEndpoint?: string;
  }>;
}

let _cache: RegistrySkill[] | null = null;

export function loadSkillsRegistry(): RegistrySkill[] {
  if (_cache) return _cache;

  try {
    // Try loading from the monorepo config directory
    const raw = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "..",
        "config",
        "system-skills.json"
      ),
      "utf-8"
    );
    const data = JSON.parse(raw) as { skills: RegistrySkill[] };
    _cache = data.skills;
    return _cache;
  } catch {
    // Fallback: try relative to dist
    try {
      const raw = readFileSync(
        join(__dirname, "..", "..", "system-skills.json"),
        "utf-8"
      );
      const data = JSON.parse(raw) as { skills: RegistrySkill[] };
      _cache = data.skills;
      return _cache;
    } catch {
      return [];
    }
  }
}

export function getSkillById(id: string): RegistrySkill | undefined {
  return loadSkillsRegistry().find((s) => s.id === id);
}

export function isProviderSkill(skill: RegistrySkill): boolean {
  return !!(skill.providers && skill.providers.length > 0);
}
