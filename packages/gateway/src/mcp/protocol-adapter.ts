import { createLogger } from "@peerbot/core";

const logger = createLogger("mcp-protocol-adapter");

export type McpProtocolType = "streamable-http" | "sse" | "stdio";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class McpProtocolAdapter {
  /**
   * Translate Claude Code HTTP (JSON-RPC) request to Streamable HTTP format
   */
  async translateToStreamableHttp(
    jsonRpcRequest: JsonRpcRequest,
    upstreamUrl: string,
    oauthToken?: string,
    sessionId?: string
  ): Promise<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };

    // Add session ID if provided (for resumption)
    if (sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
    }

    // Add OAuth token if provided
    if (oauthToken) {
      headers.Authorization = `Bearer ${oauthToken}`;
    }

    // Streamable HTTP uses POST for all JSON-RPC messages
    return {
      url: upstreamUrl,
      method: "POST",
      headers,
      body: JSON.stringify(jsonRpcRequest),
    };
  }

  /**
   * Translate Streamable HTTP response back to Claude Code format
   */
  async translateFromStreamableHttp(response: Response): Promise<{
    data: JsonRpcResponse | JsonRpcResponse[];
    sessionId?: string;
  }> {
    // Extract session ID from response headers
    const sessionId = response.headers.get("Mcp-Session-Id") || undefined;

    const contentType = response.headers.get("content-type") || "";

    // Handle SSE streaming responses
    if (contentType.includes("text/event-stream")) {
      const messages = await this.parseSSEStream(response);
      return { data: messages, sessionId };
    }

    // Handle regular JSON response
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as JsonRpcResponse;
      return { data, sessionId };
    }

    // Fallback: treat as error
    const text = await response.text();
    logger.warn("Unexpected content-type from upstream MCP", {
      contentType,
      bodyPreview: text.substring(0, 200),
    });

    return {
      data: {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Invalid response from upstream MCP",
          data: { contentType, body: text.substring(0, 500) },
        },
      },
      sessionId,
    };
  }

  /**
   * Parse Server-Sent Events stream into JSON-RPC messages
   */
  private async parseSSEStream(response: Response): Promise<JsonRpcResponse[]> {
    const messages: JsonRpcResponse[] = [];

    if (!response.body) {
      return messages;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let eventData = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            eventData += line.substring(6);
          } else if (line === "") {
            // Empty line marks end of event
            if (eventData) {
              try {
                const message = JSON.parse(eventData) as JsonRpcResponse;
                messages.push(message);
              } catch (error) {
                logger.warn("Failed to parse SSE event data", {
                  error,
                  eventData,
                });
              }
              eventData = "";
            }
          }
          // Ignore other SSE fields (id:, event:, retry:)
        }
      }
    } catch (error) {
      logger.error("Error reading SSE stream", { error });
    }

    return messages;
  }

  /**
   * Detect protocol type from MCP server config
   */
  detectProtocol(config: {
    url?: string;
    command?: string;
    protocol?: string;
  }): McpProtocolType {
    // Explicit protocol specified
    if (config.protocol) {
      return config.protocol as McpProtocolType;
    }

    // stdio if command is specified
    if (config.command) {
      return "stdio";
    }

    // Default to streamable-http for URL-based servers
    if (config.url) {
      return "streamable-http";
    }

    return "streamable-http";
  }
}
