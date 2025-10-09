import { getProcessManagerInstance } from "../integrations/process-manager";

/**
 * Generate MCP configuration dynamically based on running MCP servers
 */
export function generateMCPConfig(): string {
  const mcpServers: Record<string, any> = {};

  // Add process manager MCP if running
  const processManager = getProcessManagerInstance();
  if (processManager) {
    mcpServers["process-manager"] = {
      type: "sse",
      url: `http://localhost:${processManager.port}/sse`,
      description:
        "Process management MCP server for background tasks with cloudflared tunnel support (HTTP streaming)",
    };
  }

  return JSON.stringify({ mcpServers }, null, 2);
}

/**
 * Get MCP config path for Claude CLI
 * Returns the config as a JSON string to be written to a temp file
 */
export function getMCPConfigForClaude(): string | undefined {
  const processManager = getProcessManagerInstance();
  if (!processManager) {
    return undefined;
  }

  return generateMCPConfig();
}
