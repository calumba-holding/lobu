# MCP Integration Plan

## Goals
- Load MCP server definitions from environment variables compatible with Claude-style JSON manifests.
- Expose MCP availability in Slack Home tab with authentication status and actions.
- Support OAuth-backed and stdin-secret-backed MCPs with secure credential storage in Redis secret store.
- Ensure worker processes automatically receive authorized credentials and reuse them without prompting users repeatedly.
- Provide foundations that can support multiple CLI adapters (Claude Code today, Codex CLI later) without UI changes.

## Configuration Loading
1. **Environment Variable Schema**
   - Define `PEERBOT_MCP_SERVERS_FILE` pointing to a local JSON file (Claude-compatible schema) that lives alongside other deployment configs.
   - Loader reads and parses the file during orchestrator bootstrap, normalizing entries into internal schema: `id`, `displayName`, `adapter`, `manifestPath` or `endpoint`, and `auth` metadata (`type`, `oauthConfigId`, `stdinSecretName`, scopes, audience, tokenTransport, etc.).
   - Perform structural validation (Zod schema) and emit metrics for missing/invalid fields. When validation fails, return empty list but continue serving Slack so the Home tab can communicate the misconfiguration.
   - Keep the file path in config so we can watch for changes (fs watcher or inotify when running on bare metal; in containers trigger reload hook via SIGHUP or configmap reload sidecar). On change, reload registry and bump version counter.
2. **Shared Registry**
   - Implement `packages/shared/src/mcp/registry.ts` exporting a singleton `McpRegistry` that loads the env var once, indexes by `id`, and exposes read-only getters.
   - Provide adapter hints so the worker orchestrator knows which CLI adapter to instantiate per MCP.
   - Include version/hash of manifest and the source file `mtime` so workers can detect reconfiguration. Publish internal event (Redis pub/sub or message bus) when registry changes so long-lived workers can refresh without restart.

## Authentication & Credential Storage
1. **Secret Provider Abstraction**
   - Introduce `McpCredentialStore` interface (in shared package) with methods: `getUserCredentials(userId, mcpId)`, `setUserCredentials(userId, mcpId, secretPayload, metadata)`, `deleteUserCredentials(...)`, `listAuthorizedMcps(userId)`.
   - Default implementation uses Redis secret store with namespacing: keys like `mcp:cred:${teamId}:${userId}:${mcpId}` storing encrypted JSON (AES-GCM) via existing KMS wrapper.
   - Store metadata: issuedAt, expiresAt, refreshToken, scopes, tokenType, providerId, adapter expectations (e.g., env var name), and monotonically increasing `credentialVersion`.
2. **OAuth Flow**
   - Slack Home tab presents "Connect" / "Login" buttons for each MCP needing auth.
   - Clicking launches Slack modal -> app backend generates OAuth state token (team, user, mcpId, redirect) stored in Redis with TTL 10 minutes.
   - Upon OAuth callback, exchange code using provider config (client id/secret stored in backend secrets). Save tokens in credential store and mark `needsReauth=false`. Persist gateway-generated `sessionNonce` that workers can present when requesting fresh tokens (prevents replay).
   - Support refresh tokens: background job refreshes tokens proactively using `expiresAt` minus buffer; on failure mark `needsReauth` and notify user via Slack DM. When refresh succeeds, increment `credentialVersion` and publish `mcp-token-updated` event with `(teamId, userId, mcpId, version)` payload.
3. **Stdin Secret Collection**
   - For `auth.type=stdin`, present Slack modal with secure input (single-use). Encrypt and store in credential store. Mark `rotatable=false` unless UI collects new value.
   - When user updates secret, version increments to force worker re-login.

## Worker Injection & Lifecycle
1. **Connection Request Flow**
   - When worker bootstraps for a conversation, orchestrator queries `McpRegistry` for default MCPs and `McpCredentialStore` for user tokens. If token is absent, mark MCP as `pendingAuth` but still pass metadata so worker can prompt gracefully.
   - Worker spawn context receives sanitized `MCP_CONTEXT` object: list of MCPs with resolved manifest paths, credential metadata (id, version, expiresAt, transport), and a signed one-time `gatewaySessionToken` allowing the worker to request the latest secret directly from the gateway on demand.
   - Credentials are never written to disk permanently: mount tmpfs directory or use in-memory env injection. The worker calls gateway to exchange `gatewaySessionToken` for the actual OAuth access token immediately before establishing the CLI session, minimizing exposure window.
   - Workers load credentials into CLI adapter before establishing connection:
     - For OAuth tokens retrieved via gateway: set env vars expected by CLI or write to ephemeral config file consumed by CLI, ensuring file is deleted after CLI acknowledges login.
     - For stdin secrets: worker requests the secret blob from gateway, streams to CLI stdin once, then wipes memory buffers. Cache success marker in worker memory to avoid repeated prompts.
2. **Credential Reuse**
   - Worker maintains in-memory map `authorizedMcps` keyed by `mcpId` storing last `credentialVersion` seen. Before each request and on heartbeat timer, it compares against version fetched from gateway via lightweight `HEAD /mcp-token` call. When version increments (user re-logged or refresh happened), worker re-fetches token and reinitializes CLI session as needed.
   - Subscribe workers to Redis pub/sub channel `mcp:token-updated` scoped by user/team. Upon message, worker fetches fresh token from gateway immediately; this covers mid-conversation logins or manual revocations without polling delay.
   - If worker crashes or is re-created, orchestrator rehydrates credentials at start, enabling single-login experience across sessions.
3. **Token Refresh Handling**
   - Worker receives `expiresAt` and proactively calls gateway when the buffer window (e.g., 5 minutes) is reached; gateway refreshes using stored refresh token. Gateway returns both new token and updated `expiresAt`/`version`.
   - In case of refresh failure mid-session, worker sends Slack notification instructing user to re-login and marks local state `needsReauth` to avoid retry storms. Slack Home tab re-renders via event.

4. **Gateway Token Broker & MCP Proxy (Optional)**
   - **Gateway Broker**: Implement `/internal/mcp/token` endpoint (mutual TLS or signed session token required) that reads encrypted credentials from Redis, refreshes when expired, and responds with short-lived token payload plus `version`.
   - **Reverse Proxy Mode**: For MCPs that support HTTP(S), gateway can expose `/mcp/proxy/:mcpId/*` which injects current OAuth token into outbound requests, shielding workers from token handling entirely. CLI adapter then points to proxy URL, and gateway attaches credentials per request.
   - **Proxy Advantages**: centralizes token refresh, simplifies worker logic, supports real-time token changes, and allows revocation without restarting workers. Downside: gateway becomes critical path; need rate limiting, connection pooling, and SSE streaming support (ensure proxy handles `EventSource` with auth header injection).
   - **Recommendation**: Start with broker mode (workers still make direct MCP connections but fetch tokens via gateway). Introduce full proxy for MCPs requiring complex auth or when CLI lacks token injection hooks. Design interfaces so adapters can toggle between `direct` and `proxy` transport.

## Slack Home Tab Implementation
1. **Data Model**
   - Extend existing user preferences data to include `authorizedMcpIds`, `needsReauth`, `lastSeen`. Keep statuses in Redis or Postgres depending on existing store.
   - Provide backend API `GET /slack/home/:userId` that fetches registry entries, joins with credential status, and generates Block Kit view.
2. **UI Blocks**
   - For each MCP: show title, description, status badge (Connected, Needs Login, Expired, Offline), and buttons `Connect`/`Re-auth`/`Disconnect` as appropriate.
   - Include "Add Custom MCP" if we later allow user-defined endpoints (future).
   - Display last login timestamp and adapter type for transparency.
3. **Event Handling**
   - On button press, handle Slack interactivity: open OAuth modal or secret input modal.
   - After successful auth, re-render home tab using Slack `views.publish`.
   - If worker reports failure (e.g., invalid token), send ephemeral message and set status to `Needs Login` before re-rendering.

## Edge Cases & Mitigations
- **Missing or malformed env var**: fail-safe to empty registry; log error and show Home tab message "No MCPs configured".
- **Multiple teams/users**: namespace credentials by Slack team + user. Ensure cross-team isolation even if running multi-tenant.
- **Token expiry during conversation**: worker requests refresh; if refresh fails, gracefully degrade (stop streaming, prompt re-login) without crashing CLI.
- **Mid-conversation first-time login**: user authenticates after worker already running; gateway publishes token-update event, worker fetches new token, replays login handshake, and resumes conversation without requiring restart.
- **Redis unavailability**: operations fail fast; Home tab shows error message; workers avoid starting sensitive sessions without credentials. Consider circuit breaker to prevent repeated login prompts.
- **Concurrent logins**: enforce single-flight by locking on `mcpId:userId` key when performing OAuth exchange or secret update.
- **Revocation & Logout**: Provide "Disconnect" button that deletes credentials and resets worker state. Worker should drop sessions gracefully and remove cached tokens.
- **Adapter variance**: For MCPs requiring Codex CLI later, ensure adapter interface handles CLI-specific login commands while still using shared credential injection contract.
- **SSE/Stream restarts**: When SSE disconnects due to auth failure, propagate to orchestrator, mark credentials invalid, and notify user.
- **Manifest updates**: If env manifest changes (detected via hash difference), flush relevant worker caches and require re-auth if scopes differ.
- **User deactivation**: On Slack user removal, run cleanup job to delete stored credentials for compliance.
- **Auditability**: Log credential lifecycle events (create/update/delete) with masked tokens for security review.

## Implementation Steps
1. Build `McpRegistry` and load env var at orchestrator startup; add unit tests using sample JSON.
2. Implement Redis-backed `McpCredentialStore` with encryption utilities from shared package.
3. Extend Slack backend to surface registry + auth status in Home tab; create handlers for OAuth/secret flows.
4. Update worker bootstrap to receive `MCP_CONTEXT` payload with registry metadata plus signed `gatewaySessionToken`; teach orchestrator to mint session tokens per worker launch.
5. Modify Claude adapter to request runtime credentials from gateway broker/proxy and consume them; add placeholders for future Codex adapter to use identical hook.
6. Add monitoring hooks (metrics + logs) for login successes, failures, token refresh counts.
7. Write integration tests simulating login, worker restart, token refresh, and SSE auth failure recovery.

