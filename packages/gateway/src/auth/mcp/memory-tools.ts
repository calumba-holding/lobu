import type {
  LinkMemoryRequest,
  MemoryRecordType,
  RecallMemoryRequest,
  SaveMemoryRequest,
  UpdateMemoryRequest,
} from "@lobu/core";
import type { McpTool } from "./tool-cache";

export const VIRTUAL_MEMORY_MCP_ID = "memory";
export const OWLETTO_MCP_ID = "owletto";

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
interface JsonObject {
  [key: string]: JsonValue;
}

export interface VirtualMemoryToolCall {
  backendToolName: string;
  backendArgs: Record<string, unknown>;
  fallbackSaveText?: string;
}

export const MEMORY_TOOLS: McpTool[] = [
  {
    name: "SaveMemory",
    description: "Persist a typed memory record.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "identity",
            "preference",
            "decision",
            "fact",
            "event",
            "observation",
            "todo",
          ],
        },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        importance: { type: "number" },
        source: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["type", "content"],
    },
    annotations: { idempotentHint: true },
  },
  {
    name: "RecallMemory",
    description: "Recall relevant typed memories.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        filter: {
          type: "object",
          properties: {
            types: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            from: { type: "string" },
            to: { type: "string" },
          },
        },
        limit: { type: "number" },
        sort: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: ["createdAt", "updatedAt", "importance"],
            },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
        },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "UpdateMemory",
    description: "Update an existing memory record.",
    inputSchema: {
      type: "object",
      properties: {
        memoryId: { type: "string" },
        type: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        importance: { type: "number" },
        idempotencyKey: { type: "string" },
      },
      required: ["memoryId"],
    },
    annotations: { idempotentHint: true },
  },
  {
    name: "LinkMemory",
    description: "Create a typed relation between two memories.",
    inputSchema: {
      type: "object",
      properties: {
        fromMemoryId: { type: "string" },
        toMemoryId: { type: "string" },
        relation: {
          type: "string",
          enum: [
            "related_to",
            "updates",
            "contradicts",
            "caused_by",
            "result_of",
            "part_of",
          ],
        },
        idempotencyKey: { type: "string" },
      },
      required: ["fromMemoryId", "toMemoryId", "relation"],
    },
    annotations: { idempotentHint: true },
  },
];

const MEMORY_TOOL_NAMES = new Set(MEMORY_TOOLS.map((tool) => tool.name));
const MEMORY_TYPES = new Set<MemoryRecordType>([
  "identity",
  "preference",
  "decision",
  "fact",
  "event",
  "observation",
  "todo",
]);

export function isVirtualMemoryMcpId(mcpId: string): boolean {
  return mcpId === VIRTUAL_MEMORY_MCP_ID;
}

export function isVirtualMemoryTool(toolName: string): boolean {
  return MEMORY_TOOL_NAMES.has(toolName);
}

export function mapVirtualMemoryToolCall(
  toolName: string,
  args: Record<string, unknown>
): VirtualMemoryToolCall | null {
  if (toolName === "SaveMemory") {
    const input = args as unknown as SaveMemoryRequest;
    return {
      backendToolName: "save_content",
      backendArgs: {
        content: serializeSaveContent(input),
      },
    };
  }

  if (toolName === "RecallMemory") {
    const input = args as unknown as RecallMemoryRequest;
    return {
      backendToolName: "search",
      backendArgs: {
        query: buildRecallQuery(input),
      },
    };
  }

  if (toolName === "UpdateMemory") {
    const input = args as unknown as UpdateMemoryRequest;
    const serialized = serializeUpdateFallback(input);
    return {
      backendToolName: "update_content",
      backendArgs: {
        memoryId: input.memoryId,
        content: input.content,
        tags: input.tags,
        importance: input.importance,
        type: input.type,
        idempotencyKey: input.idempotencyKey,
      },
      fallbackSaveText: serialized,
    };
  }

  if (toolName === "LinkMemory") {
    const input = args as unknown as LinkMemoryRequest;
    const serialized = serializeLinkFallback(input);
    return {
      backendToolName: "link_memory",
      backendArgs: {
        fromMemoryId: input.fromMemoryId,
        toMemoryId: input.toMemoryId,
        relation: input.relation,
        idempotencyKey: input.idempotencyKey,
      },
      fallbackSaveText: serialized,
    };
  }

  return null;
}

export function isUnknownToolError(errorMessage: string): boolean {
  return /(unknown tool|tool not found|method not found|invalid tool)/i.test(
    errorMessage
  );
}

function serializeSaveContent(input: SaveMemoryRequest): string {
  const normalizedType = MEMORY_TYPES.has(input.type)
    ? input.type
    : "observation";
  const payload: JsonObject = {
    type: normalizedType,
    content: input.content,
  };

  if (input.tags && input.tags.length > 0) payload.tags = input.tags;
  if (typeof input.importance === "number")
    payload.importance = input.importance;
  if (input.source) payload.source = input.source;
  if (input.idempotencyKey) payload.idempotencyKey = input.idempotencyKey;

  return JSON.stringify(payload);
}

function buildRecallQuery(input: RecallMemoryRequest): string {
  const fragments: string[] = [];

  if (typeof input.query === "string" && input.query.trim()) {
    fragments.push(input.query.trim());
  }

  if (input.filter?.types?.length) {
    fragments.push(`types:${input.filter.types.join(",")}`);
  }
  if (input.filter?.tags?.length) {
    fragments.push(`tags:${input.filter.tags.join(",")}`);
  }
  if (input.filter?.from) {
    fragments.push(`from:${input.filter.from}`);
  }
  if (input.filter?.to) {
    fragments.push(`to:${input.filter.to}`);
  }
  if (typeof input.limit === "number") {
    fragments.push(`limit:${input.limit}`);
  }
  if (input.sort?.field) {
    fragments.push(
      `sort:${input.sort.field}:${input.sort.direction || "desc"}`
    );
  }

  if (fragments.length === 0) {
    return "recent memories";
  }
  return fragments.join(" ");
}

function serializeUpdateFallback(input: UpdateMemoryRequest): string {
  const payload: JsonObject = {
    op: "update_memory",
    memoryId: input.memoryId,
  };
  if (input.content) payload.content = input.content;
  if (input.tags && input.tags.length > 0) payload.tags = input.tags;
  if (typeof input.importance === "number")
    payload.importance = input.importance;
  if (input.type) payload.type = input.type;
  if (input.idempotencyKey) payload.idempotencyKey = input.idempotencyKey;

  return JSON.stringify(payload);
}

function serializeLinkFallback(input: LinkMemoryRequest): string {
  const payload: JsonObject = {
    op: "link_memory",
    fromMemoryId: input.fromMemoryId,
    toMemoryId: input.toMemoryId,
    relation: input.relation,
  };
  if (input.idempotencyKey) payload.idempotencyKey = input.idempotencyKey;
  return JSON.stringify(payload);
}
