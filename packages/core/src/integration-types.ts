/**
 * Shared types for the integration system.
 *
 * OAuth credential management for third-party APIs (GitHub, Google, etc.)
 * is handled by Owletto.
 */

import type { ProviderConfigEntry } from "./provider-config-types";

// System Skills Config (config/system-skills.json)

export interface SystemSkillEntry {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  hidden?: boolean;
  mcpServers?: import("./types").SkillMcpServer[];
  providers?: ProviderConfigEntry[];
  nixPackages?: string[];
  permissions?: string[];
}

export interface SystemSkillsConfigFile {
  skills: SystemSkillEntry[];
}
