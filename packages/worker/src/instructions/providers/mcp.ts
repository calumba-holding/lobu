import { createLogger } from "@peerbot/core";
import type { InstructionContext, InstructionProvider } from "../types";

const logger = createLogger("mcp-instructions");

interface McpStatus {
  id: string;
  name: string;
  requiresAuth: boolean;
  requiresInput: boolean;
  authenticated: boolean;
  configured: boolean;
}

interface McpStatusResponse {
  mcps: McpStatus[];
}

/**
 * Provides instructions about MCP tool availability
 * Informs users which MCPs need authentication or configuration
 */
export class McpInstructionProvider implements InstructionProvider {
  name = "mcp";
  priority = 15; // After core (10) but before slack (20)

  async getInstructions(_context: InstructionContext): Promise<string> {
    const mcpStatus = await this.fetchMcpStatus();

    if (!mcpStatus || mcpStatus.length === 0) {
      return "";
    }

    // Find MCPs that need setup
    const unavailableMcps = mcpStatus.filter(
      (mcp) =>
        (mcp.requiresAuth && !mcp.authenticated) ||
        (mcp.requiresInput && !mcp.configured)
    );

    if (unavailableMcps.length === 0) {
      return "";
    }

    // Build instruction message
    const lines: string[] = ["## MCP Tools Requiring Setup"];

    for (const mcp of unavailableMcps) {
      const reasons: string[] = [];
      if (mcp.requiresAuth && !mcp.authenticated) {
        reasons.push("OAuth authentication");
      }
      if (mcp.requiresInput && !mcp.configured) {
        reasons.push("configuration");
      }

      lines.push(
        `- ⚠️ **${mcp.name}**: Requires ${reasons.join(" and ")} - visit Home tab to set up`
      );
    }

    return lines.join("\n");
  }

  private async fetchMcpStatus(): Promise<McpStatus[] | null> {
    const dispatcherUrl = process.env.DISPATCHER_URL;
    const workerToken = process.env.WORKER_TOKEN;

    if (!dispatcherUrl || !workerToken) {
      logger.debug(
        "Missing dispatcher URL or worker token for MCP status fetch"
      );
      return null;
    }

    try {
      const url = new URL(
        "/worker/mcp/status",
        this.ensureBaseUrl(dispatcherUrl)
      );
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${workerToken}`,
        },
      });

      if (!response.ok) {
        logger.warn("Gateway returned non-success status for MCP status", {
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as McpStatusResponse;
      if (!data || !Array.isArray(data.mcps)) {
        logger.warn("Gateway MCP status response malformed");
        return null;
      }

      return data.mcps;
    } catch (error) {
      logger.error("Failed to fetch MCP status from gateway", { error });
      return null;
    }
  }

  private ensureBaseUrl(base: string): string {
    if (!base.startsWith("http")) {
      return `http://${base.replace(/^\/+/, "")}`;
    }
    return base;
  }
}
