/**
 * Connection CRUD routes + webhook endpoint.
 *
 * Webhook: POST /api/chat/webhook/:connectionId
 * CRUD (auth: settings session cookie):
 *   POST   /api/v1/connections
 *   GET    /api/v1/connections
 *   GET    /api/v1/connections/:id
 *   PATCH  /api/v1/connections/:id
 *   DELETE /api/v1/connections/:id
 *   POST   /api/v1/connections/:id/restart
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createLogger } from "@lobu/core";
import { Hono } from "hono";
import type { AgentMetadataStore } from "../../auth/agent-metadata-store";
import type { UserAgentsStore } from "../../auth/user-agents-store";
import type { ChatInstanceManager } from "../../connections/chat-instance-manager";
import { SUPPORTED_PLATFORMS } from "../../connections/types";
import { resolveSettingsLookupUserId, verifyAgentAccess } from "./agent-access";
import { verifySettingsSession } from "./settings-auth";

const logger = createLogger("connection-routes");
const TAG = "Connections";

const SupportedPlatformSchema = z.enum(SUPPORTED_PLATFORMS);
const ErrorResponseSchema = z.object({ error: z.string() });
const FlexibleObjectSchema = z.record(z.string(), z.unknown());

const ConnectionSettingsSchema = z.object({
  allowFrom: z.array(z.string()).optional().openapi({
    description:
      "User IDs allowed to interact with this connection. Empty = allow all.",
  }),
  allowGroups: z.boolean().optional().openapi({
    description: "Whether group messages are allowed (default true).",
  }),
});

// --- Per-platform config Zod schemas ---

const TelegramConfigSchema = z.object({
  platform: z.literal("telegram"),
  botToken: z.string().optional().openapi({
    description:
      "Telegram bot token from BotFather. Falls back to TELEGRAM_BOT_TOKEN env var.",
  }),
  mode: z.enum(["auto", "webhook", "polling"]).optional().openapi({
    description: "Runtime mode: auto (default), webhook, or polling.",
  }),
  secretToken: z.string().optional().openapi({
    description:
      "Webhook secret token for x-telegram-bot-api-secret-token verification.",
  }),
  userName: z
    .string()
    .optional()
    .openapi({ description: "Override bot username." }),
  apiBaseUrl: z
    .string()
    .optional()
    .openapi({ description: "Custom Telegram API base URL." }),
});

const SlackConfigSchema = z.object({
  platform: z.literal("slack"),
  botToken: z.string().optional().openapi({
    description: "Bot token (xoxb-...). Required for single-workspace mode.",
  }),
  botUserId: z.string().optional().openapi({
    description: "Bot user ID (fetched automatically if omitted).",
  }),
  signingSecret: z
    .string()
    .optional()
    .openapi({ description: "Signing secret for webhook verification." }),
  clientId: z.string().optional().openapi({
    description: "Slack app client ID (required for OAuth / multi-workspace).",
  }),
  clientSecret: z.string().optional().openapi({
    description:
      "Slack app client secret (required for OAuth / multi-workspace).",
  }),
  encryptionKey: z.string().optional().openapi({
    description:
      "Base64-encoded 32-byte AES-256-GCM key for encrypting stored bot tokens.",
  }),
  installationKeyPrefix: z.string().optional().openapi({
    description:
      "State key prefix for workspace installations (default: slack:installation).",
  }),
  userName: z
    .string()
    .optional()
    .openapi({ description: "Override bot username." }),
});

const DiscordConfigSchema = z.object({
  platform: z.literal("discord"),
  botToken: z
    .string()
    .optional()
    .openapi({ description: "Discord bot token." }),
  applicationId: z
    .string()
    .optional()
    .openapi({ description: "Discord application ID." }),
  publicKey: z.string().optional().openapi({
    description: "Application public key for webhook signature verification.",
  }),
  mentionRoleIds: z.array(z.string()).optional().openapi({
    description:
      "Role IDs that trigger mention handlers (in addition to direct mentions).",
  }),
  userName: z
    .string()
    .optional()
    .openapi({ description: "Override bot username." }),
});

const WhatsAppConfigSchema = z.object({
  platform: z.literal("whatsapp"),
  accessToken: z.string().optional().openapi({
    description: "System User access token for WhatsApp Cloud API.",
  }),
  phoneNumberId: z
    .string()
    .optional()
    .openapi({ description: "WhatsApp Business phone number ID." }),
  appSecret: z.string().optional().openapi({
    description:
      "Meta App Secret for webhook HMAC-SHA256 signature verification.",
  }),
  verifyToken: z
    .string()
    .optional()
    .openapi({ description: "Verify token for webhook challenge-response." }),
  apiVersion: z
    .string()
    .optional()
    .openapi({ description: "Meta Graph API version (default: v21.0)." }),
  userName: z.string().optional().openapi({ description: "Bot display name." }),
});

const TeamsConfigSchema = z.object({
  platform: z.literal("teams"),
  appId: z.string().optional().openapi({ description: "Microsoft App ID." }),
  appPassword: z
    .string()
    .optional()
    .openapi({ description: "Microsoft App Password." }),
  appTenantId: z
    .string()
    .optional()
    .openapi({ description: "Microsoft App Tenant ID." }),
  appType: z
    .enum(["MultiTenant", "SingleTenant"])
    .optional()
    .openapi({ description: "Microsoft App Type." }),
  userName: z
    .string()
    .optional()
    .openapi({ description: "Override bot username." }),
});

const PlatformAdapterConfigSchema = z.discriminatedUnion("platform", [
  TelegramConfigSchema,
  SlackConfigSchema,
  DiscordConfigSchema,
  WhatsAppConfigSchema,
  TeamsConfigSchema,
]);

const PlatformConnectionSchema = z.object({
  id: z.string(),
  platform: SupportedPlatformSchema,
  agentId: z.string(),
  config: PlatformAdapterConfigSchema,
  settings: ConnectionSettingsSchema,
  metadata: FlexibleObjectSchema,
  status: z.enum(["active", "stopped", "error"]),
  errorMessage: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const CreateConnectionRequestSchema = z.object({
  platform: SupportedPlatformSchema,
  agentId: z.string(),
  config: PlatformAdapterConfigSchema,
  settings: ConnectionSettingsSchema.optional(),
});

const UpdateConnectionRequestSchema = z.object({
  agentId: z.string().optional(),
  config: PlatformAdapterConfigSchema.optional(),
  settings: ConnectionSettingsSchema.optional(),
});

const ConnectionIdParamsSchema = z.object({
  id: z.string(),
});

const ListConnectionsQuerySchema = z.object({
  platform: SupportedPlatformSchema.optional(),
  agentId: z.string().optional(),
});

const CreateConnectionRoute = createRoute({
  method: "post",
  path: "/api/v1/connections",
  tags: [TAG],
  summary: "Create a platform connection",
  description: "Creates and starts a Chat SDK-backed connection for an agent.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateConnectionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Connection created",
      content: {
        "application/json": {
          schema: PlatformConnectionSchema,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const ListConnectionsRoute = createRoute({
  method: "get",
  path: "/api/v1/connections",
  tags: [TAG],
  summary: "List platform connections",
  description:
    "Lists Chat SDK-backed connections visible to the current settings session.",
  request: {
    query: ListConnectionsQuerySchema,
  },
  responses: {
    200: {
      description: "Connections",
      content: {
        "application/json": {
          schema: z.object({
            connections: z.array(PlatformConnectionSchema),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const GetConnectionRoute = createRoute({
  method: "get",
  path: "/api/v1/connections/{id}",
  tags: [TAG],
  summary: "Get a platform connection",
  request: {
    params: ConnectionIdParamsSchema,
  },
  responses: {
    200: {
      description: "Connection",
      content: {
        "application/json": {
          schema: PlatformConnectionSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Connection not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const UpdateConnectionRoute = createRoute({
  method: "patch",
  path: "/api/v1/connections/{id}",
  tags: [TAG],
  summary: "Update a platform connection",
  request: {
    params: ConnectionIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateConnectionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated connection",
      content: {
        "application/json": {
          schema: PlatformConnectionSchema,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Connection not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const DeleteConnectionRoute = createRoute({
  method: "delete",
  path: "/api/v1/connections/{id}",
  tags: [TAG],
  summary: "Delete a platform connection",
  request: {
    params: ConnectionIdParamsSchema,
  },
  responses: {
    200: {
      description: "Connection removed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
          }),
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Connection not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const RestartConnectionRoute = createRoute({
  method: "post",
  path: "/api/v1/connections/{id}/restart",
  tags: [TAG],
  summary: "Restart a platform connection",
  request: {
    params: ConnectionIdParamsSchema,
  },
  responses: {
    200: {
      description: "Restarted connection",
      content: {
        "application/json": {
          schema: PlatformConnectionSchema.nullable(),
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Connection not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export function createConnectionWebhookRoutes(
  manager: ChatInstanceManager
): Hono {
  const router = new Hono();

  router.post("/api/chat/webhook/:connectionId", async (c) => {
    const connectionId = c.req.param("connectionId");
    if (!connectionId) {
      return c.json({ error: "Missing connectionId" }, 400);
    }

    try {
      const response = await manager.handleWebhook(connectionId, c.req.raw);
      return response;
    } catch (error) {
      logger.error({ connectionId, error: String(error) }, "Webhook error");
      return c.json({ error: "Webhook processing failed" }, 500);
    }
  });

  return router;
}

export function createConnectionCrudRoutes(
  manager: ChatInstanceManager,
  accessConfig: {
    userAgentsStore: UserAgentsStore;
    agentMetadataStore: AgentMetadataStore;
  }
): OpenAPIHono {
  const app = new OpenAPIHono();

  app.openapi(CreateConnectionRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const body = c.req.valid("json");

      if (!(await verifyAgentAccess(session, body.agentId, accessConfig))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const connection = await manager.addConnection(
        body.platform,
        body.agentId,
        body.config,
        body.settings
      );

      logger.info(
        { id: connection.id, platform: body.platform, agentId: body.agentId },
        "Connection created via API"
      );

      return c.json(connection, 201);
    } catch (error) {
      logger.error({ error: String(error) }, "Failed to create connection");
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create connection",
        },
        400
      );
    }
  });

  app.openapi(ListConnectionsRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { platform, agentId } = c.req.valid("query");
    let connections;

    if (agentId) {
      if (!(await verifyAgentAccess(session, agentId, accessConfig))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      connections = await manager.listConnections({
        platform: platform || undefined,
        agentId,
      });
    } else if (session.agentId) {
      connections = await manager.listConnections({
        platform: platform || undefined,
        agentId: session.agentId,
      });
    } else {
      const lookupUserId = resolveSettingsLookupUserId(session);
      const agentIds = await accessConfig.userAgentsStore.listAgents(
        session.platform,
        lookupUserId
      );
      const results = await Promise.all(
        agentIds.map((ownedAgentId) =>
          manager.listConnections({
            platform: platform || undefined,
            agentId: ownedAgentId,
          })
        )
      );
      connections = results.flat();
    }

    return c.json({ connections });
  });

  app.openapi(GetConnectionRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");
    const connection = await manager.getConnection(id);
    if (!connection) {
      return c.json({ error: "Connection not found" }, 404);
    }
    if (!(await verifyAgentAccess(session, connection.agentId, accessConfig))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    return c.json(connection);
  });

  app.openapi(UpdateConnectionRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");

    try {
      const existing = await manager.getConnection(id);
      if (!existing) {
        return c.json({ error: "Connection not found" }, 404);
      }
      if (!(await verifyAgentAccess(session, existing.agentId, accessConfig))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const body = c.req.valid("json");

      if (
        body.agentId &&
        !(await verifyAgentAccess(session, body.agentId, accessConfig))
      ) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const updated = await manager.updateConnection(id, body);
      return c.json(updated);
    } catch (error) {
      logger.error({ id, error: String(error) }, "Failed to update connection");
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update connection",
        },
        400
      );
    }
  });

  app.openapi(DeleteConnectionRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");

    try {
      const existing = await manager.getConnection(id);
      if (!existing) {
        return c.json({ error: "Connection not found" }, 404);
      }
      if (!(await verifyAgentAccess(session, existing.agentId, accessConfig))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      await manager.removeConnection(id);
      return c.json({ success: true });
    } catch (error) {
      logger.error({ id, error: String(error) }, "Failed to remove connection");
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to remove connection",
        },
        400
      );
    }
  });

  app.openapi(RestartConnectionRoute, async (c): Promise<any> => {
    const session = verifySettingsSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");

    try {
      const existing = await manager.getConnection(id);
      if (!existing) {
        return c.json({ error: "Connection not found" }, 404);
      }
      if (!(await verifyAgentAccess(session, existing.agentId, accessConfig))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      await manager.restartConnection(id);
      const connection = await manager.getConnection(id);
      return c.json(connection);
    } catch (error) {
      logger.error(
        { id, error: String(error) },
        "Failed to restart connection"
      );
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to restart connection",
        },
        400
      );
    }
  });

  return app;
}
