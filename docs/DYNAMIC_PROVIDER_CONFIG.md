# Dynamic Provider Configuration

## Problem

Provider config (model, credentials, proxy URLs) is baked into worker deployment env vars at creation time. When a user changes their provider in settings, the worker keeps using the old provider until the deployment is destroyed and recreated. This causes:

1. **Stale provider after settings change** - User switches from Claude to z.ai, but worker still uses Claude because `AGENT_DEFAULT_PROVIDER=anthropic` is hardcoded in the K8s deployment spec
2. **Deployment churn** - Current workaround deletes and recreates deployments on wake-up (`base-deployment-manager.ts:281-295`) just to refresh env vars
3. **Session identity leakage** - Old assistant messages from the previous provider persist in the session file, causing the new model to mimic the old identity (e.g. ChatGPT saying "I'm Claude Code")

## Current Architecture

```
Settings Change → Redis (stored) → Next message → generateEnvironmentVariables()
→ Baked into K8s deployment spec → Worker reads from process.env → Static for lifetime of deployment
```

**Env vars set at deployment time** (in `generateEnvironmentVariables()`, `base-deployment-manager.ts:569-787`):
- `AGENT_DEFAULT_PROVIDER` - provider slug (line 732)
- `AGENT_DEFAULT_MODEL` - model ID (set by Claude module's `buildEnvVars`)
- `CREDENTIAL_ENV_VAR_NAME` - which env var holds the API key (line 726)
- `CLI_BACKENDS` - JSON array of CLI backend configs (line 769)
- Provider-specific API keys and base URLs (e.g. `Z_AI_API_KEY`, `Z_AI_API_BASE_URL`)

**SSE events the gateway can push to workers** (in `connection-manager.ts`):
- `connected` - initial handshake
- `ping` - heartbeat every 30s
- `job` - message payload with agentOptions

**No `config_changed` event exists.**

## Proposed Solution

### Phase 1: Add `config_changed` SSE event

When settings change, push a notification to affected workers so they refresh their config.

#### Gateway Side

**1. Add `config_changed` SSE event to `WorkerConnectionManager`** (`packages/gateway/src/gateway/connection-manager.ts`)

Add a method to send config change notifications to a specific worker:

```typescript
notifyConfigChanged(deploymentName: string): boolean {
  const connection = this.connections.get(deploymentName);
  if (!connection) return false;
  return this.sendSSE(connection.writer, "config_changed", { timestamp: Date.now() });
}
```

**2. Trigger notification on settings save** (`packages/gateway/src/routes/public/agent-config.ts`)

After `agentSettingsStore.updateSettings()` at line 329, find all active worker deployments for this agent and notify them. The orchestrator already tracks deployment → agent mappings.

The settings save endpoint (`PATCH /api/v1/agents/{agentId}/config`, line 289) currently only sends MCP notifications (lines 332-345). Extend this to also notify workers of provider/model changes.

**3. Add provider config to session context endpoint** (`packages/gateway/src/gateway/index.ts`)

The worker already calls `GET /worker/session-context` (line 203) per-message. Extend the response to include provider config:

```typescript
// Add to session context response (line 285-294):
{
  // ... existing fields ...
  providerConfig: {
    provider: "z-ai",           // AGENT_DEFAULT_PROVIDER equivalent
    model: "glm-4.7",          // AGENT_DEFAULT_MODEL equivalent
    credentialEnvVarName: "Z_AI_API_KEY",
    providerBaseUrl: "http://gateway:8080/api/proxy/z-ai",
    providerBaseUrlMappings: { ... },
    cliBackends: [ ... ],
  }
}
```

This reuses the same logic from `generateEnvironmentVariables()` but returns it dynamically instead of baking it into env vars.

#### Worker Side

**4. Handle `config_changed` event in SSE client** (`packages/worker/src/gateway/sse-client.ts`)

Add a new case in `handleEvent()` (line 289):

```typescript
if (eventType === "config_changed") {
  // Refresh provider config from gateway before next message
  this.providerConfigStale = true;
  return;
}
```

**5. Refresh provider config on next message** (`packages/worker/src/openclaw/worker.ts`)

In `runAISession()` (line 335), instead of reading provider from env vars:

```typescript
// BEFORE (static from env vars):
const { provider, modelId } = resolveModelRef(modelRef);
const credEnvVar = process.env.CREDENTIAL_ENV_VAR_NAME;

// AFTER (dynamic from gateway):
const providerConfig = await this.getProviderConfig(); // calls session context endpoint
const { provider, modelId } = resolveModelRef(modelRef, providerConfig);
```

The `getProviderConfig()` call uses the session context endpoint which the worker already calls. The response just needs to include provider config (step 3 above).

**6. Cache provider config, refresh on `config_changed`**

Don't call the endpoint per-message. Cache the provider config and only refresh when:
- Worker starts (initial fetch)
- `config_changed` SSE event received
- Cache miss (first message)

### Phase 2: Remove static env vars

Once provider config is dynamic, remove the static env vars from deployment creation:

**Remove from `generateEnvironmentVariables()`** (`base-deployment-manager.ts`):
- `AGENT_DEFAULT_PROVIDER` (line 732)
- `AGENT_DEFAULT_MODEL` (cleared at line 711, but the whole block can go)
- `CREDENTIAL_ENV_VAR_NAME` (line 726)
- Provider-specific API keys injected by `buildModuleEnvVars` (line 613)
- `CLI_BACKENDS` (line 769)

**Remove from worker** (`worker.ts`):
- `DEFAULT_PROVIDER_BASE_URL_ENV` map (line 52)
- `DEFAULT_PROVIDER_MODELS` map (line 62)
- `PROVIDER_REGISTRY_ALIASES` map (line 74)
- `process.env.AGENT_DEFAULT_PROVIDER` reads in `resolveModelRef` (line 850)
- `process.env.CREDENTIAL_ENV_VAR_NAME` reads (line 386)

**Remove deployment recreation workaround** (`base-deployment-manager.ts`):
- Lines 281-295: The "delete and recreate scaled-down deployments" logic is no longer needed since env vars aren't the source of truth

### Phase 3: Handle provider-specific secrets through proxy

Provider API keys still need to reach the worker. The secret proxy (`/api/proxy`) already handles this — the worker calls the gateway proxy which injects the real API key. The proxy just needs to know which provider/agent to use, which comes from the worker token + deployment metadata.

Currently secrets are injected as env vars at deployment time via `injectSecretPlaceholders()` (line 520). Instead:
- The session context response includes which credential env var to use
- The proxy already resolves the real secret from Redis at request time
- Short-lived placeholder tokens in env vars can be replaced by per-request token injection through the proxy

## Files to Modify

### Gateway
| File | Change |
|------|--------|
| `packages/gateway/src/gateway/connection-manager.ts` | Add `notifyConfigChanged()` method |
| `packages/gateway/src/gateway/index.ts` | Extend session context response with provider config |
| `packages/gateway/src/routes/public/agent-config.ts` | Trigger `config_changed` SSE event on settings save |
| `packages/gateway/src/orchestration/base-deployment-manager.ts` | (Phase 2) Remove static provider env vars from `generateEnvironmentVariables()` |
| `packages/gateway/src/orchestration/deployment-utils.ts` | (Phase 2) Remove `buildModuleEnvVars` call for provider env vars |

### Worker
| File | Change |
|------|--------|
| `packages/worker/src/gateway/sse-client.ts` | Handle `config_changed` event type |
| `packages/worker/src/openclaw/worker.ts` | Read provider config from session context instead of env vars |
| `packages/worker/src/openclaw/session-context.ts` | Parse provider config from session context response |

### Core
| File | Change |
|------|--------|
| `packages/core/src/modules.ts` | (Phase 2) Remove `buildEnvVars` from `OrchestratorModule` interface if no longer needed |

## Migration Strategy

1. **Phase 1 first** - Add the `config_changed` event and dynamic provider config alongside existing env vars. Worker tries dynamic config first, falls back to env vars. Zero breaking changes.
2. **Phase 2** - Once stable, stop setting provider env vars at deployment time. Worker fully relies on dynamic config.
3. **Phase 3** - Move secret injection from deployment env vars to per-request proxy injection.

## Key Principles

- **Worker is provider-agnostic** - it doesn't know or care which provider at startup. It asks the gateway before each conversation.
- **Gateway is the source of truth** - provider selection, credential resolution, and proxy routing all happen in the gateway.
- **SSE for push notifications** - settings changes are pushed, not polled. Worker caches config and only refreshes when notified.
- **Backwards compatible** - env var fallback during migration means no big-bang cutover.
