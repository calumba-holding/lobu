import { createLogger, verifyWorkerToken } from "@lobu/core";
import type { Context } from "hono";
import { Hono } from "hono";
import type { IMessageQueue } from "../../infrastructure/queue";
import { requiresToolApproval } from "../../permissions/approval-policy";
import type { GrantStore } from "../../permissions/grant-store";
import type { McpConfigService } from "./config-service";
import type { McpCredentialStore } from "./credential-store";
import type { McpInputStore } from "./input-store";
import {
  authenticateRequest,
  extractSessionToken,
  forwardRequestWithProtocolTranslation,
  type JsonRpcResponse,
  type ProxyHandlerDeps,
  refreshCredentials,
  resolveMcpServer,
  sendJsonRpcError,
  sendUpstreamRequest,
} from "./proxy-handlers";
import type { McpTool, McpToolCache } from "./tool-cache";

const logger = createLogger("mcp-proxy");

export class McpProxy {
  private readonly SESSION_TTL_SECONDS = 30 * 60; // 30 minutes
  private readonly redisClient: any;
  private app: Hono;
  private toolCache?: McpToolCache;
  private readonly refreshLocks: Map<string, Promise<any>> = new Map();
  private readonly deps: ProxyHandlerDeps;

  constructor(
    private readonly configService: McpConfigService,
    private readonly credentialStore: McpCredentialStore,
    private readonly inputStore: McpInputStore,
    queue: IMessageQueue,
    toolCache?: McpToolCache,
    private readonly grantStore?: GrantStore
  ) {
    this.redisClient = queue.getRedisClient();
    this.toolCache = toolCache;
    this.app = new Hono();
    this.deps = {
      configService: this.configService,
      credentialStore: this.credentialStore,
      inputStore: this.inputStore,
      redisClient: this.redisClient,
      sessionTtlSeconds: this.SESSION_TTL_SECONDS,
      refreshLocks: this.refreshLocks,
    };
    this.setupRoutes();
    logger.info("MCP proxy initialized with Redis session storage", {
      ttlMinutes: this.SESSION_TTL_SECONDS / 60,
    });
  }

  /**
   * Get the Hono app
   */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Check if this request is an MCP proxy request (has X-Mcp-Id header)
   * Used by gateway to determine if root path requests should be handled by MCP proxy
   */
  isMcpRequest(c: Context): boolean {
    return !!c.req.header("x-mcp-id");
  }

  /**
   * Fetch tools for a specific MCP server.
   * Used by session-context handler to include tool lists in the response.
   */
  async fetchToolsForMcp(
    mcpId: string,
    agentId: string,
    tokenData: any
  ): Promise<McpTool[]> {
    // Check cache first
    if (this.toolCache) {
      const cached = await this.toolCache.get(mcpId, agentId);
      if (cached) return cached;
    }

    // Resolve MCP server
    const resolved = await resolveMcpServer(mcpId, tokenData, this.deps);
    if (!resolved) return [];

    try {
      const jsonRpcBody = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 1,
      });

      const response = await sendUpstreamRequest(
        resolved.httpServer,
        resolved.credentials,
        resolved.inputValues,
        resolved.agentId,
        mcpId,
        "POST",
        this.deps,
        jsonRpcBody
      );

      const data = (await response.json()) as JsonRpcResponse;
      const tools: McpTool[] = data?.result?.tools || [];

      // Cache result
      if (this.toolCache && tools.length > 0) {
        await this.toolCache.set(mcpId, tools, agentId);
      }

      return tools;
    } catch (error) {
      logger.error("Failed to fetch tools for MCP", { mcpId, error });
      return [];
    }
  }

  private setupRoutes() {
    // REST API endpoints for curl-based tool access (registered BEFORE catch-all)
    this.app.get("/tools", (c) => this.handleListAllTools(c));
    this.app.get("/:mcpId/tools", (c) => this.handleListTools(c));
    this.app.post("/:mcpId/tools/:toolName", (c) => this.handleCallTool(c));

    // Legacy endpoints (if needed for other MCP transports)
    this.app.all("/register", (c) => this.handleProxyRequest(c));
    this.app.all("/message", (c) => this.handleProxyRequest(c));

    // Path-based routes (for SSE or other transports)
    this.app.all("/:mcpId", (c) => this.handleProxyRequest(c));
    this.app.all("/:mcpId/*", (c) => this.handleProxyRequest(c));
  }

  // ===========================================================================
  // REST API handlers
  // ===========================================================================

  /**
   * GET /mcp/:mcpId/tools - List tools for a specific MCP server
   */
  private async handleListTools(c: Context): Promise<Response> {
    const mcpId = c.req.param("mcpId");
    const auth = authenticateRequest(c);
    if (!auth) return c.json({ error: "Invalid authentication token" }, 401);

    const resolved = await resolveMcpServer(mcpId, auth.tokenData, this.deps);
    if (!resolved) {
      return c.json({ error: `MCP server '${mcpId}' not found` }, 404);
    }

    // Check cache
    if (this.toolCache) {
      const cached = await this.toolCache.get(mcpId, resolved.agentId);
      if (cached) return c.json({ tools: cached });
    }

    try {
      const jsonRpcBody = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 1,
      });

      const response = await sendUpstreamRequest(
        resolved.httpServer,
        resolved.credentials,
        resolved.inputValues,
        resolved.agentId,
        mcpId,
        "POST",
        this.deps,
        jsonRpcBody
      );

      const data = (await response.json()) as JsonRpcResponse;
      if (data?.error) {
        logger.error("Upstream returned JSON-RPC error", {
          mcpId,
          error: data.error,
        });
        return c.json({ error: data.error.message || "Upstream error" }, 502);
      }

      const tools: McpTool[] = data?.result?.tools || [];

      // Cache result
      if (this.toolCache && tools.length > 0) {
        await this.toolCache.set(mcpId, tools, resolved.agentId);
      }

      return c.json({ tools });
    } catch (error) {
      logger.error("Failed to list tools", { mcpId, error });
      return c.json(
        {
          error: `Failed to connect to MCP '${mcpId}': ${error instanceof Error ? error.message : "Unknown error"}`,
        },
        502
      );
    }
  }

  /**
   * POST /mcp/:mcpId/tools/:toolName - Call a tool on a specific MCP server
   */
  private async handleCallTool(c: Context): Promise<Response> {
    const mcpId = c.req.param("mcpId");
    const toolName = c.req.param("toolName");
    const auth = authenticateRequest(c);
    if (!auth) return c.json({ error: "Invalid authentication token" }, 401);

    const resolved = await resolveMcpServer(mcpId, auth.tokenData, this.deps);
    if (!resolved) {
      return c.json({ error: `MCP server '${mcpId}' not found` }, 404);
    }

    // Check tool approval based on annotations and grants
    if (this.grantStore) {
      const annotations = await this.getToolAnnotations(
        mcpId,
        toolName,
        resolved.agentId,
        auth.tokenData
      );
      if (requiresToolApproval(annotations)) {
        const pattern = `/mcp/${mcpId}/tools/${toolName}`;
        const hasGrant = await this.grantStore.hasGrant(
          resolved.agentId,
          pattern
        );
        if (!hasGrant) {
          logger.info("Tool call blocked: requires approval", {
            agentId: resolved.agentId,
            mcpId,
            toolName,
            pattern,
          });
          return c.json(
            {
              content: [
                {
                  type: "text",
                  text: `Tool call requires approval. Grant access via settings page for: ${mcpId} → ${toolName}`,
                },
              ],
              isError: true,
            },
            403
          );
        }
      }
    }

    let toolArguments: Record<string, unknown> = {};
    try {
      const body = await c.req.text();
      if (body) {
        toolArguments = JSON.parse(body);
      }
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    try {
      const jsonRpcBody = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: toolArguments },
        id: 1,
      });

      const response = await sendUpstreamRequest(
        resolved.httpServer,
        resolved.credentials,
        resolved.inputValues,
        resolved.agentId,
        mcpId,
        "POST",
        this.deps,
        jsonRpcBody
      );

      const data = (await response.json()) as JsonRpcResponse;
      if (data?.error) {
        logger.error("Upstream returned JSON-RPC error on tool call", {
          mcpId,
          toolName,
          error: data.error,
        });
        return c.json(
          {
            content: [],
            isError: true,
            error: data.error.message || "Upstream error",
          },
          502
        );
      }

      const result = data?.result || {};
      return c.json({
        content: result.content || [],
        isError: result.isError || false,
      });
    } catch (error) {
      logger.error("Failed to call tool", { mcpId, toolName, error });
      return c.json(
        {
          content: [],
          isError: true,
          error: `Failed to connect to MCP '${mcpId}': ${error instanceof Error ? error.message : "Unknown error"}`,
        },
        502
      );
    }
  }

  /**
   * GET /mcp/tools - List all tools across all MCP servers
   */
  private async handleListAllTools(c: Context): Promise<Response> {
    const auth = authenticateRequest(c);
    if (!auth) return c.json({ error: "Invalid authentication token" }, 401);

    const agentId = auth.tokenData.agentId || auth.tokenData.userId;

    const allHttpServers = await this.configService.getAllHttpServers(
      agentId,
      auth.tokenData.deploymentName
    );
    const allMcpIds = Array.from(allHttpServers.keys());

    const mcpServers: Record<string, { tools: McpTool[] }> = {};

    // Fetch tools in parallel, tolerate failures
    const results = await Promise.allSettled(
      allMcpIds.map(async (mcpId) => {
        const tools = await this.fetchToolsForMcp(
          mcpId,
          agentId,
          auth.tokenData
        );
        return { mcpId, tools };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.tools.length > 0) {
        mcpServers[result.value.mcpId] = { tools: result.value.tools };
      }
    }

    return c.json({ mcpServers });
  }

  // ===========================================================================
  // Original proxy handler (streaming, used by MCP SDK clients)
  // ===========================================================================

  private async handleProxyRequest(c: Context): Promise<Response> {
    const mcpId = c.req.param("mcpId") || c.req.header("x-mcp-id");
    const sessionToken = extractSessionToken(c);

    logger.info("Handling MCP proxy request", {
      method: c.req.method,
      path: c.req.path,
      mcpId,
      hasSessionToken: !!sessionToken,
    });

    if (!mcpId) {
      return sendJsonRpcError(c, -32600, "Missing MCP ID");
    }

    if (!sessionToken) {
      return sendJsonRpcError(c, -32600, "Missing authentication token");
    }

    const tokenData = verifyWorkerToken(sessionToken);
    if (!tokenData) {
      return sendJsonRpcError(c, -32600, "Invalid authentication token");
    }

    const agentId = tokenData.agentId || tokenData.userId;
    const httpServer = await this.configService.getHttpServer(
      mcpId!,
      agentId,
      tokenData.deploymentName
    );

    if (!httpServer) {
      return sendJsonRpcError(c, -32601, `MCP server '${mcpId}' not found`);
    }

    // Check authentication - OAuth or inputs
    let credentials = null;
    let inputValues = null;
    const hasOAuth = !!httpServer.oauth;
    const discoveredOAuth = await this.configService.getDiscoveredOAuth(mcpId!);
    const hasDiscoveredOAuth = !!discoveredOAuth;

    if (hasOAuth || hasDiscoveredOAuth) {
      credentials = await this.credentialStore.getCredentials(agentId, mcpId!);

      if (!credentials || !credentials.accessToken) {
        logger.info("MCP OAuth credentials missing", { agentId, mcpId });
        return sendJsonRpcError(
          c,
          -32002,
          `MCP '${mcpId}' requires authentication. Please authenticate via the Slack app home tab.`
        );
      }

      if (credentials.expiresAt && credentials.expiresAt <= Date.now()) {
        logger.info("MCP access token expired, attempting refresh", {
          agentId,
          mcpId,
          hasRefreshToken: !!credentials.refreshToken,
        });

        if (credentials.refreshToken) {
          try {
            credentials = await refreshCredentials(
              httpServer,
              discoveredOAuth,
              credentials.refreshToken,
              agentId,
              mcpId!,
              this.deps
            );
          } catch (error) {
            logger.error("Failed to refresh MCP access token", {
              error,
              errorMessage:
                error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
              agentId,
              mcpId,
            });
            return sendJsonRpcError(
              c,
              -32002,
              `MCP '${mcpId}' authentication expired. Please re-authenticate via the Slack app home tab.`
            );
          }
        } else {
          logger.warn("MCP credentials expired with no refresh token", {
            agentId,
            mcpId,
          });
          return sendJsonRpcError(
            c,
            -32002,
            `MCP '${mcpId}' authentication expired. Please re-authenticate via the Slack app home tab.`
          );
        }
      }
    }

    // Load input values if MCP uses inputs
    if (httpServer.inputs && httpServer.inputs.length > 0) {
      inputValues = await this.inputStore.getInputs(agentId, mcpId!);

      if (!inputValues) {
        logger.info("MCP input values missing", { agentId, mcpId });
        return sendJsonRpcError(
          c,
          -32002,
          `MCP '${mcpId}' requires configuration. Please configure via the Slack app home tab.`
        );
      }
    }

    try {
      return await forwardRequestWithProtocolTranslation(
        c,
        httpServer,
        credentials,
        inputValues || {},
        agentId,
        mcpId!,
        this.deps
      );
    } catch (error) {
      logger.error("Failed to proxy MCP request", { error, mcpId });
      return sendJsonRpcError(
        c,
        -32603,
        `Failed to connect to MCP '${mcpId}': ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Look up tool annotations from the cache.
   * Falls back to fetching tools if not cached.
   */
  private async getToolAnnotations(
    mcpId: string,
    toolName: string,
    agentId: string,
    tokenData: any
  ): Promise<McpTool["annotations"] | undefined> {
    // Check cache first
    let tools: McpTool[] | null = null;
    if (this.toolCache) {
      tools = await this.toolCache.get(mcpId, agentId);
    }

    // Fetch if not cached
    if (!tools) {
      tools = await this.fetchToolsForMcp(mcpId, agentId, tokenData);
    }

    const tool = tools.find((t) => t.name === toolName);
    return tool?.annotations;
  }
}
