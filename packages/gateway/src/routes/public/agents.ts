/**
 * Agent Management Routes - Create, list, update, and delete user agents
 *
 * Routes:
 * - POST /api/v1/manage/agents - Create a new agent
 * - GET /api/v1/manage/agents - List user's agents (requires token)
 * - PATCH /api/v1/manage/agents/{agentId} - Update agent name/description
 * - DELETE /api/v1/manage/agents/{agentId} - Delete an agent
 */

import { createLogger } from "@lobu/core";
import { Hono } from "hono";
import type { AgentMetadataStore } from "../../auth/agent-metadata-store";
import type { AgentSettings, AgentSettingsStore } from "../../auth/settings";
import type { UserAgentsStore } from "../../auth/user-agents-store";
import type { ChannelBindingService } from "../../channels";
import { verifySettingsSession } from "./settings-auth";

const logger = createLogger("agent-routes");

/** Environment-configurable limits */
const MAX_AGENTS_PER_USER = parseInt(
  process.env.MAX_AGENTS_PER_USER || "0",
  10
);

export interface AgentRoutesConfig {
  userAgentsStore: UserAgentsStore;
  agentMetadataStore: AgentMetadataStore;
  agentSettingsStore: AgentSettingsStore;
  channelBindingService: ChannelBindingService;
}

/**
 * Sanitize user-provided agentId.
 * Lowercase alphanumeric with hyphens, 3-60 chars, must start with a letter.
 */
function sanitizeAgentId(input: string): string | null {
  const cleaned = input.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (cleaned.length < 3 || cleaned.length > 60) return null;
  if (!/^[a-z]/.test(cleaned)) return null;
  return cleaned;
}

function cloneSettingValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildDefaultSettingsFromSource(
  source: AgentSettings | null
): Omit<AgentSettings, "updatedAt"> {
  if (!source) return {};

  const defaults: Omit<AgentSettings, "updatedAt"> = {};

  if (source.model !== undefined) defaults.model = source.model;
  if (source.modelSelection)
    defaults.modelSelection = cloneSettingValue(source.modelSelection);
  if (source.providerModelPreferences)
    defaults.providerModelPreferences = cloneSettingValue(
      source.providerModelPreferences
    );
  if (source.networkConfig)
    defaults.networkConfig = cloneSettingValue(source.networkConfig);
  if (source.nixConfig)
    defaults.nixConfig = cloneSettingValue(source.nixConfig);
  if (source.mcpServers)
    defaults.mcpServers = cloneSettingValue(source.mcpServers);
  if (source.soulMd !== undefined) defaults.soulMd = source.soulMd;
  if (source.userMd !== undefined) defaults.userMd = source.userMd;
  if (source.identityMd !== undefined) defaults.identityMd = source.identityMd;
  if (source.skillsConfig)
    defaults.skillsConfig = cloneSettingValue(source.skillsConfig);
  if (source.toolsConfig)
    defaults.toolsConfig = cloneSettingValue(source.toolsConfig);
  if (source.pluginsConfig)
    defaults.pluginsConfig = cloneSettingValue(source.pluginsConfig);
  if (source.installedProviders) {
    defaults.installedProviders = cloneSettingValue(source.installedProviders);
  }
  if (source.verboseLogging !== undefined) {
    defaults.verboseLogging = source.verboseLogging;
  }

  return defaults;
}

export function createAgentRoutes(config: AgentRoutesConfig): Hono {
  const router = new Hono();

  // POST /api/v1/agents - Create a new agent
  router.post("/", async (c) => {
    const payload = verifySettingsSession(c);
    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    try {
      const body = await c.req.json<{
        agentId: string;
        name: string;
        description?: string;
        channelId?: string;
      }>();

      if (!body.agentId || !body.name) {
        return c.json({ error: "agentId and name are required" }, 400);
      }

      const agentId = sanitizeAgentId(body.agentId);
      if (!agentId) {
        return c.json(
          {
            error:
              "Invalid agentId. Must be 3-40 chars, lowercase alphanumeric with hyphens, starting with a letter.",
          },
          400
        );
      }

      // Check if agentId already exists
      const existing = await config.agentMetadataStore.hasAgent(agentId);
      if (existing) {
        return c.json({ error: "An agent with this ID already exists" }, 409);
      }

      // Check per-user limit
      if (MAX_AGENTS_PER_USER > 0) {
        const userAgents = await config.userAgentsStore.listAgents(
          payload.platform,
          payload.userId
        );
        if (userAgents.length >= MAX_AGENTS_PER_USER) {
          return c.json(
            {
              error: `Agent limit reached (${MAX_AGENTS_PER_USER}). Delete an existing agent first.`,
            },
            429
          );
        }
      }

      // Create metadata
      await config.agentMetadataStore.createAgent(
        agentId,
        body.name,
        payload.platform,
        payload.userId,
        { description: body.description }
      );

      // Create default settings, seeded from the current workspace/channel agent when available.
      let defaultSettings: Omit<AgentSettings, "updatedAt"> = {};
      try {
        let sourceAgentId = payload.agentId;
        if (!sourceAgentId && body.channelId) {
          const binding = await config.channelBindingService.getBinding(
            payload.platform,
            body.channelId,
            payload.teamId
          );
          sourceAgentId = binding?.agentId;
        }

        if (sourceAgentId) {
          const sourceSettings =
            await config.agentSettingsStore.getSettings(sourceAgentId);
          defaultSettings = buildDefaultSettingsFromSource(sourceSettings);
        }
      } catch (error) {
        logger.warn("Failed to derive source defaults for new agent", {
          error,
        });
      }
      await config.agentSettingsStore.saveSettings(agentId, defaultSettings);

      // Associate with user
      await config.userAgentsStore.addAgent(
        payload.platform,
        payload.userId,
        agentId
      );

      // Auto-bind to channel if channelId provided (from session context)
      if (body.channelId) {
        await config.channelBindingService.createBinding(
          agentId,
          payload.platform,
          body.channelId,
          payload.teamId,
          { configuredBy: payload.userId }
        );
      }

      logger.info(
        `Created agent ${agentId} for user ${payload.platform}/${payload.userId}${body.channelId ? ` (bound to ${body.channelId})` : ""}`
      );

      return c.json({
        agentId,
        name: body.name,
        settingsUrl: `/settings?agentId=${encodeURIComponent(agentId)}`,
      });
    } catch (error) {
      logger.error("Failed to create agent", { error });
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create agent",
        },
        500
      );
    }
  });

  // GET /api/v1/agents - List user's agents
  router.get("/", async (c) => {
    const payload = verifySettingsSession(c);
    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    try {
      const agentIds = await config.userAgentsStore.listAgents(
        payload.platform,
        payload.userId
      );

      const agents = [];
      for (const agentId of agentIds) {
        const metadata = await config.agentMetadataStore.getMetadata(agentId);
        if (metadata) {
          const bindings =
            await config.channelBindingService.listBindings(agentId);
          agents.push({
            agentId,
            name: metadata.name,
            description: metadata.description,
            isWorkspaceAgent: metadata.isWorkspaceAgent,
            createdAt: metadata.createdAt,
            lastUsedAt: metadata.lastUsedAt,
            channelCount: bindings.length,
          });
        }
      }

      return c.json({ agents });
    } catch (error) {
      logger.error("Failed to list agents", { error });
      return c.json({ error: "Failed to list agents" }, 500);
    }
  });

  // PATCH /api/v1/manage/agents/{agentId} - Update agent name/description
  router.patch("/:agentId", async (c) => {
    const payload = verifySettingsSession(c);
    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    const agentId = c.req.param("agentId");
    if (!agentId) {
      return c.json({ error: "Missing agentId" }, 400);
    }

    try {
      // Verify ownership
      const owns = await config.userAgentsStore.ownsAgent(
        payload.platform,
        payload.userId,
        agentId
      );
      if (!owns) {
        return c.json({ error: "Agent not found or not owned by you" }, 404);
      }

      const body = await c.req.json<{ name?: string; description?: string }>();
      const updates: { name?: string; description?: string } = {};

      if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name || name.length > 100) {
          return c.json({ error: "Name must be 1-100 characters" }, 400);
        }
        updates.name = name;
      }

      if (body.description !== undefined) {
        const desc = body.description.trim();
        if (desc.length > 200) {
          return c.json(
            { error: "Description must be at most 200 characters" },
            400
          );
        }
        updates.description = desc;
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

      await config.agentMetadataStore.updateMetadata(agentId, updates);
      logger.info(`Updated agent identity for ${agentId}`);
      return c.json({ success: true });
    } catch (error) {
      logger.error("Failed to update agent", { error, agentId });
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update agent",
        },
        500
      );
    }
  });

  // DELETE /api/v1/manage/agents/{agentId} - Delete an agent
  router.delete("/:agentId", async (c) => {
    const payload = verifySettingsSession(c);
    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    const agentId = c.req.param("agentId");
    if (!agentId) {
      return c.json({ error: "Missing agentId" }, 400);
    }

    try {
      // Verify ownership
      const owns = await config.userAgentsStore.ownsAgent(
        payload.platform,
        payload.userId,
        agentId
      );
      if (!owns) {
        return c.json({ error: "Agent not found or not owned by you" }, 404);
      }

      // Auto-unbind all channels (Option A from plan)
      const unboundCount =
        await config.channelBindingService.deleteAllBindings(agentId);

      // Delete settings
      await config.agentSettingsStore.deleteSettings(agentId);

      // Delete metadata
      await config.agentMetadataStore.deleteAgent(agentId);

      // Remove from user's list
      await config.userAgentsStore.removeAgent(
        payload.platform,
        payload.userId,
        agentId
      );

      logger.info(
        `Deleted agent ${agentId} (unbound ${unboundCount} channels)`
      );

      return c.json({ success: true, unboundChannels: unboundCount });
    } catch (error) {
      logger.error("Failed to delete agent", { error, agentId });
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to delete agent",
        },
        500
      );
    }
  });

  logger.info("Agent management routes registered");
  return router;
}
