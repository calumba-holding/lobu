import { createLogger, verifyWorkerToken } from "@lobu/core";
import type { Context } from "hono";
import { GenericOAuth2Client } from "../oauth/generic-client";
import type { McpConfigService } from "./config-service";
import type { McpCredentialStore } from "./credential-store";
import type { McpInputStore } from "./input-store";
import { substituteObject, substituteString } from "./string-substitution";

const logger = createLogger("mcp-proxy");

export interface JsonRpcResponse {
  jsonrpc: string;
  id: unknown;
  result?: {
    tools?: import("./tool-cache").McpTool[];
    content?: unknown[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

export interface ResolvedMcp {
  httpServer: any;
  credentials: { accessToken: string; tokenType?: string } | null;
  inputValues: Record<string, string>;
  agentId: string;
}

/**
 * Dependencies that proxy-handler functions need from the McpProxy class.
 * Passed in as a parameter bag instead of using `this`.
 */
export interface ProxyHandlerDeps {
  configService: McpConfigService;
  credentialStore: McpCredentialStore;
  inputStore: McpInputStore;
  redisClient: any;
  sessionTtlSeconds: number;
  refreshLocks: Map<string, Promise<any>>;
}

const oauth2Client = new GenericOAuth2Client();

// ===========================================================================
// Authentication
// ===========================================================================

export function authenticateRequest(
  c: Context
): { tokenData: any; token: string } | null {
  const sessionToken = extractSessionToken(c);
  if (!sessionToken) return null;

  const tokenData = verifyWorkerToken(sessionToken);
  if (!tokenData) return null;

  return { tokenData, token: sessionToken };
}

export function extractSessionToken(c: Context): string | null {
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const tokenFromQuery = c.req.query("workerToken");
  if (typeof tokenFromQuery === "string") {
    return tokenFromQuery;
  }

  return null;
}

// ===========================================================================
// MCP server resolution
// ===========================================================================

/**
 * Resolve an MCP server by ID, including auth credential resolution.
 * Returns null if the MCP is not found or requires auth that is missing
 * (in that case for REST endpoints the caller returns an HTTP error).
 */
export async function resolveMcpServer(
  mcpId: string,
  tokenData: any,
  deps: ProxyHandlerDeps
): Promise<ResolvedMcp | null> {
  const agentId = tokenData.agentId || tokenData.userId;
  const httpServer = await deps.configService.getHttpServer(
    mcpId,
    agentId,
    tokenData.deploymentName
  );
  if (!httpServer) return null;

  let credentials = null;
  let inputValues: Record<string, string> = {};

  // Check OAuth (static or discovered)
  const hasOAuth = !!httpServer.oauth;
  const discoveredOAuth = await deps.configService.getDiscoveredOAuth(mcpId);
  const hasDiscoveredOAuth = !!discoveredOAuth;

  if (hasOAuth || hasDiscoveredOAuth) {
    credentials = await deps.credentialStore.getCredentials(agentId, mcpId);
    if (!credentials?.accessToken) return null;

    // Refresh expired token
    if (credentials.expiresAt && credentials.expiresAt <= Date.now()) {
      if (!credentials.refreshToken) return null;

      try {
        credentials = await refreshCredentials(
          httpServer,
          discoveredOAuth,
          credentials.refreshToken,
          agentId,
          mcpId,
          deps
        );
      } catch {
        return null;
      }
    }
  }

  // Load input values
  if (httpServer.inputs && httpServer.inputs.length > 0) {
    const inputs = await deps.inputStore.getInputs(agentId, mcpId);
    if (!inputs) return null;
    inputValues = inputs;
  }

  return { httpServer, credentials, inputValues, agentId };
}

// ===========================================================================
// Token refresh with dedup lock
// ===========================================================================

/**
 * Refresh credentials with deduplication to prevent concurrent refresh token exhaustion.
 * If a refresh is already in progress for the same agent+mcp, waits for that result.
 */
export async function refreshCredentials(
  httpServer: any,
  discoveredOAuth: any,
  refreshToken: string,
  agentId: string,
  mcpId: string,
  deps: ProxyHandlerDeps
): Promise<{ accessToken: string; tokenType?: string }> {
  const lockKey = `${agentId}:${mcpId}`;
  const existing = deps.refreshLocks.get(lockKey);
  if (existing) {
    logger.info("Waiting for in-flight token refresh", { agentId, mcpId });
    return existing;
  }

  const refreshPromise = doRefreshCredentials(
    httpServer,
    discoveredOAuth,
    refreshToken,
    agentId,
    mcpId,
    deps
  ).finally(() => {
    deps.refreshLocks.delete(lockKey);
  });

  deps.refreshLocks.set(lockKey, refreshPromise);
  return refreshPromise;
}

async function doRefreshCredentials(
  httpServer: any,
  discoveredOAuth: any,
  refreshToken: string,
  agentId: string,
  mcpId: string,
  deps: ProxyHandlerDeps
): Promise<{ accessToken: string; tokenType?: string }> {
  let oauthConfig = httpServer.oauth;

  if (!oauthConfig && discoveredOAuth?.metadata) {
    const discoveryService = deps.configService.getDiscoveryService();
    if (!discoveryService)
      throw new Error("OAuth discovery service not available");

    const clientCredentials =
      await discoveryService.getOrCreateClientCredentials(
        mcpId,
        discoveredOAuth.metadata
      );
    if (!clientCredentials?.client_id) {
      throw new Error("Failed to get client credentials for refresh");
    }

    oauthConfig = {
      authUrl: discoveredOAuth.metadata.authorization_endpoint,
      tokenUrl: discoveredOAuth.metadata.token_endpoint,
      clientId: clientCredentials.client_id,
      clientSecret: clientCredentials.client_secret || "",
      scopes: discoveredOAuth.metadata.scopes_supported || [],
      grantType: "authorization_code",
      responseType: "code",
      tokenEndpointAuthMethod: clientCredentials.token_endpoint_auth_method,
    };
  }

  if (!oauthConfig) throw new Error("No OAuth config available for refresh");

  const refreshedCredentials = await oauth2Client.refreshToken(
    refreshToken,
    oauthConfig
  );

  await deps.credentialStore.setCredentials(
    agentId,
    mcpId,
    refreshedCredentials
  );
  logger.info("Successfully refreshed MCP access token", { agentId, mcpId });
  return refreshedCredentials;
}

// ===========================================================================
// Upstream request helpers
// ===========================================================================

export function buildUpstreamHeaders(
  credentials: { accessToken: string; tokenType?: string } | null,
  inputValues: Record<string, string>,
  sessionId: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  if (credentials?.accessToken) {
    headers.Authorization = `Bearer ${credentials.accessToken}`;
  }

  // Apply input substitution to headers
  if (Object.keys(inputValues).length > 0) {
    for (const [key, value] of Object.entries(headers)) {
      headers[key] = substituteString(value, inputValues);
    }
  }

  return headers;
}

/**
 * Send a request to upstream MCP server and return the raw Response.
 * Used by REST endpoints that need to read the full response body.
 */
export async function sendUpstreamRequest(
  httpServer: any,
  credentials: { accessToken: string; tokenType?: string } | null,
  inputValues: Record<string, string>,
  agentId: string,
  mcpId: string,
  method: string,
  deps: ProxyHandlerDeps,
  body?: string
): Promise<Response> {
  const sessionKey = `mcp:session:${agentId}:${mcpId}`;
  const sessionId = await getSession(sessionKey, deps);

  const headers = buildUpstreamHeaders(credentials, inputValues, sessionId);

  // Apply input substitution to body
  let finalBody = body;
  if (finalBody && Object.keys(inputValues).length > 0) {
    try {
      const bodyJson = JSON.parse(finalBody);
      const substitutedBody = substituteObject(bodyJson, inputValues);
      finalBody = JSON.stringify(substitutedBody);
    } catch {
      finalBody = substituteString(finalBody, inputValues);
    }
  }

  const response = await fetch(httpServer.upstreamUrl, {
    method,
    headers,
    body: finalBody || undefined,
  });

  // Track session
  const newSessionId = response.headers.get("Mcp-Session-Id");
  if (newSessionId) {
    await setSession(sessionKey, newSessionId, deps);
  }

  return response;
}

/**
 * Forward request to upstream with streaming response (used by MCP SDK clients)
 */
export async function forwardRequestWithProtocolTranslation(
  c: Context,
  httpServer: any,
  credentials: { accessToken: string; tokenType?: string } | null,
  inputValues: Record<string, string>,
  agentId: string,
  mcpId: string,
  deps: ProxyHandlerDeps
): Promise<Response> {
  const sessionKey = `mcp:session:${agentId}:${mcpId}`;
  const sessionId = await getSession(sessionKey, deps);

  let bodyText = await getRequestBodyAsText(c);

  logger.info("Proxying MCP request", {
    mcpId,
    agentId,
    method: c.req.method,
    hasSession: !!sessionId,
    bodyLength: bodyText.length,
    hasInputValues: Object.keys(inputValues).length > 0,
  });

  const headers = buildUpstreamHeaders(credentials, inputValues, sessionId);

  // Apply input substitution to body
  if (Object.keys(inputValues).length > 0 && bodyText) {
    try {
      const bodyJson = JSON.parse(bodyText);
      const substitutedBody = substituteObject(bodyJson, inputValues);
      bodyText = JSON.stringify(substitutedBody);
      logger.debug("Applied input substitution to request body", {
        mcpId,
        agentId,
      });
    } catch {
      bodyText = substituteString(bodyText, inputValues);
    }
  }

  const response = await fetch(httpServer.upstreamUrl, {
    method: c.req.method,
    headers,
    body: bodyText || undefined,
  });

  const newSessionId = response.headers.get("Mcp-Session-Id");
  if (newSessionId) {
    await setSession(sessionKey, newSessionId, deps);
    logger.debug("Stored MCP session ID", {
      mcpId,
      agentId,
      sessionId: newSessionId,
    });
  }

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("Content-Type", contentType);
  }
  if (newSessionId) {
    responseHeaders.set("Mcp-Session-Id", newSessionId);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function getRequestBodyAsText(c: Context): Promise<string> {
  if (c.req.method === "GET" || c.req.method === "HEAD") {
    return "";
  }

  try {
    return await c.req.text();
  } catch {
    return "";
  }
}

// ===========================================================================
// Session helpers
// ===========================================================================

export async function getSession(
  key: string,
  deps: ProxyHandlerDeps
): Promise<string | null> {
  try {
    const sessionId = await deps.redisClient.get(key);
    if (sessionId) {
      await deps.redisClient.expire(key, deps.sessionTtlSeconds);
    }
    return sessionId;
  } catch (error) {
    logger.error("Failed to get MCP session from Redis", { key, error });
    return null;
  }
}

export async function setSession(
  key: string,
  sessionId: string,
  deps: ProxyHandlerDeps
): Promise<void> {
  try {
    await deps.redisClient.set(key, sessionId, "EX", deps.sessionTtlSeconds);
  } catch (error) {
    logger.error("Failed to store MCP session in Redis", { key, error });
  }
}

/**
 * Send a JSON-RPC 2.0 error response with 200 status code
 */
export function sendJsonRpcError(
  c: Context,
  code: number,
  message: string,
  id: any = null
): Response {
  return c.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    },
    200
  );
}
