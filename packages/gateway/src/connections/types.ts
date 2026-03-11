/**
 * Platform connection types for API-driven Chat SDK integrations.
 * Config types are derived directly from adapter factory signatures — zero maintenance.
 */

import type { createDiscordAdapter } from "@chat-adapter/discord";
import type { createSlackAdapter } from "@chat-adapter/slack";
import type { createTeamsAdapter } from "@chat-adapter/teams";
import type { createTelegramAdapter } from "@chat-adapter/telegram";
import type { createWhatsAppAdapter } from "@chat-adapter/whatsapp";

// Derive config types from what the adapter factories actually accept
type TelegramAdapterConfig = NonNullable<
  Parameters<typeof createTelegramAdapter>[0]
> & { platform: "telegram" };
type SlackAdapterConfig = NonNullable<
  Parameters<typeof createSlackAdapter>[0]
> & { platform: "slack" };
type DiscordAdapterConfig = NonNullable<
  Parameters<typeof createDiscordAdapter>[0]
> & { platform: "discord" };
type WhatsAppAdapterConfig = NonNullable<
  Parameters<typeof createWhatsAppAdapter>[0]
> & { platform: "whatsapp" };
type TeamsAdapterConfig = NonNullable<
  Parameters<typeof createTeamsAdapter>[0]
> & { platform: "teams" };

export type PlatformAdapterConfig =
  | TelegramAdapterConfig
  | SlackAdapterConfig
  | DiscordAdapterConfig
  | WhatsAppAdapterConfig
  | TeamsAdapterConfig;

export interface PlatformConnection {
  id: string;
  platform: string;
  agentId: string;
  config: PlatformAdapterConfig;
  settings: ConnectionSettings;
  metadata: Record<string, any>;
  status: "active" | "stopped" | "error";
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectionSettings {
  allowFrom?: string[];
  allowGroups?: boolean;
}

/** Heuristic: field names matching these patterns contain secrets and must be encrypted at rest. */
const SECRET_FIELD_PATTERNS = [
  "token",
  "secret",
  "password",
  "key",
  "credential",
];

export function isSecretField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return SECRET_FIELD_PATTERNS.some((p) => lower.includes(p));
}

/** Supported platform names. */
export const SUPPORTED_PLATFORMS = [
  "telegram",
  "slack",
  "discord",
  "whatsapp",
  "teams",
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
