// This file replaces @settings/app for landing page usage.
// Gateway components import { useSettings } from "../app" — the Vite plugin
// redirects that to this file, providing demo data instead of real API calls.

import { type Signal, useSignal } from "@preact/signals";
import type {
  CatalogProvider,
  McpConfig,
  ModelOption,
  PermissionGrant,
  PrefillMcp,
  PrefillSkill,
  ProviderInfo,
  ProviderState,
  Schedule,
  SettingsSnapshot,
  SettingsState,
  Skill,
} from "@settings/types";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

// ─── SettingsContextValue (mirrors gateway's app.tsx interface) ────────────

export interface SettingsContextValue {
  agentId: string;
  PROVIDERS: Record<string, ProviderInfo>;
  providerModels: Record<string, ModelOption[]>;
  catalogProviders: Signal<CatalogProvider[]>;
  providerOrder: Signal<string[]>;
  primaryProvider: Signal<string>;
  providerState: Signal<Record<string, ProviderState>>;
  showCatalog: Signal<boolean>;
  pendingProvider: Signal<(CatalogProvider & { success?: boolean }) | null>;
  deviceCodePollTimer: Signal<ReturnType<typeof setInterval> | null>;

  agentName: Signal<string>;
  agentDescription: Signal<string>;
  initialAgentName: Signal<string>;
  initialAgentDescription: Signal<string>;
  savingIdentity: Signal<boolean>;
  hasChannelId: boolean;

  successMsg: Signal<string>;
  errorMsg: Signal<string>;
  saving: Signal<boolean>;

  verboseLogging: Signal<boolean>;
  identityMd: Signal<string>;
  soulMd: Signal<string>;
  userMd: Signal<string>;

  skills: Signal<Skill[]>;
  skillsLoading: Signal<boolean>;
  skillsError: Signal<string>;

  mcpServers: Signal<Record<string, McpConfig>>;

  nixPackages: Signal<string[]>;

  permissionGrants: Signal<PermissionGrant[]>;
  permissionsLoading: Signal<boolean>;

  schedules: Signal<Schedule[]>;
  schedulesLoading: Signal<boolean>;
  schedulesError: Signal<string>;

  prefillSkills: Signal<PrefillSkill[]>;
  prefillMcpServers: Signal<PrefillMcp[]>;
  prefillGrants: Signal<string[]>;
  prefillNixPackages: Signal<string[]>;
  prefillProviders: Signal<string[]>;
  prefillBannerDismissed: Signal<boolean>;
  approvingPrefills: Signal<boolean>;

  openSections: Signal<Record<string, boolean>>;
  initialSettingsSnapshot: Signal<SettingsSnapshot | null>;

  platform: string;
  userId: string;
  channelId?: string;
  message?: string;
  showSwitcher: boolean;
  agents: SettingsState["agents"];
  providerIconUrls: Record<string, string>;

  toggleSection(id: string): void;
  openExternal(url: string): void;
  hasPendingSettingsChanges(): boolean;
  buildSettingsSnapshot(): SettingsSnapshot;
}

// ─── Context + hook ───────────────────────────────────────────────────────

const SettingsContext = createContext<SettingsContextValue>(null!);

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

// ─── Demo data ────────────────────────────────────────────────────────────

const DEMO_PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: {
    name: "Anthropic",
    authType: "api-key",
    supportedAuthTypes: ["api-key"],
    apiKeyInstructions: "Get your API key from console.anthropic.com",
    apiKeyPlaceholder: "sk-ant-...",
  },
  openai: {
    name: "OpenAI",
    authType: "api-key",
    supportedAuthTypes: ["api-key"],
    apiKeyInstructions: "Get your API key from platform.openai.com",
    apiKeyPlaceholder: "sk-...",
  },
};

const DEMO_MODELS: Record<string, ModelOption[]> = {
  anthropic: [
    { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
    { label: "Claude Haiku 3.5", value: "claude-3-5-haiku-20241022" },
  ],
  openai: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o mini", value: "gpt-4o-mini" },
  ],
};

function makeProviderState(connected: boolean): ProviderState {
  return {
    status: connected ? "Connected (api-key)" : "Not connected",
    connected,
    userConnected: connected,
    systemConnected: false,
    showAuthFlow: false,
    showCodeInput: false,
    showDeviceCode: false,
    showApiKeyInput: false,
    activeAuthTab: "api-key",
    code: "",
    apiKey: "",
    userCode: "",
    verificationUrl: "",
    pollStatus: "",
    deviceAuthId: "",
    selectedModel: "",
    modelQuery: "",
    showModelDropdown: false,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function MockSettingsProvider({
  children,
  openSections: externalOpenSections,
}: {
  children: ComponentChildren;
  openSections?: Signal<Record<string, boolean>>;
}) {
  const providerOrder = useSignal(["anthropic", "openai"]);
  const primaryProvider = useSignal("anthropic");
  const providerState = useSignal<Record<string, ProviderState>>({
    anthropic: makeProviderState(true),
    openai: makeProviderState(true),
  });
  const catalogProviders = useSignal<CatalogProvider[]>([]);
  const showCatalog = useSignal(false);
  const pendingProvider = useSignal<
    (CatalogProvider & { success?: boolean }) | null
  >(null);
  const deviceCodePollTimer = useSignal<ReturnType<typeof setInterval> | null>(
    null
  );

  const agentName = useSignal("My Assistant");
  const agentDescription = useSignal("A helpful AI assistant");
  const initialAgentName = useSignal("My Assistant");
  const initialAgentDescription = useSignal("A helpful AI assistant");
  const savingIdentity = useSignal(false);

  const successMsg = useSignal("");
  const errorMsg = useSignal("");
  const saving = useSignal(false);

  const verboseLogging = useSignal(false);
  const identityMd = useSignal("You are a helpful AI assistant named Lobu.");
  const soulMd = useSignal(
    "Be concise and friendly. Use markdown formatting when helpful."
  );
  const userMd = useSignal("");

  const skills = useSignal<Skill[]>([]);
  const skillsLoading = useSignal(false);
  const skillsError = useSignal("");

  const mcpServers = useSignal<Record<string, McpConfig>>({
    gmail: {
      enabled: true,
      url: "https://gmail-mcp.lobu.ai",
      description: "Gmail — read & send emails",
    },
    github: {
      enabled: true,
      url: "https://github-mcp.lobu.ai",
      description: "GitHub — repos, PRs, issues",
    },
  });
  const nixPackages = useSignal<string[]>([
    "ffmpeg",
    "gifsicle",
    "imagemagick",
  ]);

  const permissionGrants = useSignal<PermissionGrant[]>([
    {
      pattern: "api.github.com",
      expiresAt: null,
      grantedAt: Date.now() - 86400000,
    },
    {
      pattern: "registry.npmjs.org",
      expiresAt: null,
      grantedAt: Date.now() - 86400000,
    },
    {
      pattern: "api.stripe.com",
      expiresAt: Date.now() + 3 * 3600000,
      grantedAt: Date.now(),
    },
  ]);
  const permissionsLoading = useSignal(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const schedules = useSignal<Schedule[]>([
    {
      scheduleId: "sched-1",
      task: "Check open PRs and summarize review queue",
      scheduledFor: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: "pending",
      isRecurring: true,
      cron: "0 9 * * 1",
      iteration: 1,
      maxIterations: 100,
    },
    {
      scheduleId: "sched-2",
      task: "Review Q1 deck",
      scheduledFor: tomorrow.toISOString(),
      status: "pending",
    },
  ]);
  const schedulesLoading = useSignal(false);
  const schedulesError = useSignal("");

  const prefillSkills = useSignal<PrefillSkill[]>([]);
  const prefillMcpServers = useSignal<PrefillMcp[]>([]);
  const prefillGrants = useSignal<string[]>([]);
  const prefillNixPackages = useSignal<string[]>([]);
  const prefillProviders = useSignal<string[]>([]);
  const prefillBannerDismissed = useSignal(true);
  const approvingPrefills = useSignal(false);

  const internalOpenSections = useSignal<Record<string, boolean>>({});
  const openSections = externalOpenSections ?? internalOpenSections;
  const initialSettingsSnapshot = useSignal<SettingsSnapshot | null>(null);

  const ctx: SettingsContextValue = {
    agentId: "demo-agent",
    PROVIDERS: DEMO_PROVIDERS,
    providerModels: DEMO_MODELS,
    catalogProviders,
    providerOrder,
    primaryProvider,
    providerState,
    showCatalog,
    pendingProvider,
    deviceCodePollTimer,

    agentName,
    agentDescription,
    initialAgentName,
    initialAgentDescription,
    savingIdentity,
    hasChannelId: false,

    successMsg,
    errorMsg,
    saving,

    verboseLogging,
    identityMd,
    soulMd,
    userMd,

    skills,
    skillsLoading,
    skillsError,

    mcpServers,

    nixPackages,

    permissionGrants,
    permissionsLoading,

    schedules,
    schedulesLoading,
    schedulesError,

    prefillSkills,
    prefillMcpServers,
    prefillGrants,
    prefillNixPackages,
    prefillProviders,
    prefillBannerDismissed,
    approvingPrefills,

    openSections,
    initialSettingsSnapshot,

    platform: "telegram",
    userId: "demo-user",
    showSwitcher: false,
    agents: [],
    providerIconUrls: {
      anthropic: "https://cdn.simpleicons.org/anthropic",
      openai: "https://cdn.simpleicons.org/openai",
    },

    toggleSection(id: string) {
      openSections.value = {
        ...openSections.value,
        [id]: !openSections.value[id],
      };
    },
    openExternal(url: string) {
      window.open(url, "_blank");
    },
    hasPendingSettingsChanges: () => false,
    buildSettingsSnapshot: () => ({
      identityMd: "",
      soulMd: "",
      userMd: "",
      verboseLogging: false,
      primaryProvider: "",
      providerOrder: "",
      nixPackages: "",
      skills: "",
      mcpServers: "",
      permissions: "",
    }),
  };

  return (
    <SettingsContext.Provider value={ctx}>{children}</SettingsContext.Provider>
  );
}
