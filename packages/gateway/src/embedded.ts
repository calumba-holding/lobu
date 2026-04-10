import type { AuthProfile } from "@lobu/core";

export type EmbeddedAuthProvider =
  import("./routes/public/settings-auth").AuthProvider;

export interface ProviderCredentialContext {
  userId?: string;
  conversationId?: string;
  channelId?: string;
  deploymentName?: string;
  platform?: string;
  connectionId?: string;
}

export interface RuntimeProviderCredentialLookup
  extends ProviderCredentialContext {
  agentId: string;
  provider: string;
  model?: string;
}

export interface RuntimeProviderCredentialResult {
  credential?: string;
  credentialRef?: string;
  authType?: AuthProfile["authType"];
  label?: string;
  metadata?: AuthProfile["metadata"];
}

export type RuntimeProviderCredentialResolver = (
  input: RuntimeProviderCredentialLookup
) =>
  | Promise<RuntimeProviderCredentialResult | null | undefined>
  | RuntimeProviderCredentialResult
  | null
  | undefined;
