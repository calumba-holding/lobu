import { describe, expect, test } from "bun:test";
import {
  isUnknownToolError,
  MEMORY_TOOLS,
  mapVirtualMemoryToolCall,
} from "../auth/mcp/memory-tools";

describe("memory-tools mapping", () => {
  test("maps SaveMemory to save_content", () => {
    const mapped = mapVirtualMemoryToolCall("SaveMemory", {
      type: "fact",
      content: "User timezone is Europe/London",
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.backendToolName).toBe("save_content");
    expect(mapped?.backendArgs).toEqual({
      content: JSON.stringify({
        type: "fact",
        content: "User timezone is Europe/London",
      }),
    });
  });

  test("maps RecallMemory to search with composed query", () => {
    const mapped = mapVirtualMemoryToolCall("RecallMemory", {
      query: "timezone",
      filter: { types: ["fact"], tags: ["profile"] },
      limit: 3,
      sort: { field: "updatedAt", direction: "desc" },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.backendToolName).toBe("search");
    expect(mapped?.backendArgs).toEqual({
      query: "timezone types:fact tags:profile limit:3 sort:updatedAt:desc",
    });
  });

  test("maps UpdateMemory with fallback note", () => {
    const mapped = mapVirtualMemoryToolCall("UpdateMemory", {
      memoryId: "m_1",
      content: "Updated content",
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.backendToolName).toBe("update_content");
    expect(typeof mapped?.fallbackSaveText).toBe("string");
    expect(mapped?.fallbackSaveText).toContain("update_memory");
  });

  test("exposes exactly four typed memory tools", () => {
    expect(MEMORY_TOOLS.map((tool) => tool.name)).toEqual([
      "SaveMemory",
      "RecallMemory",
      "UpdateMemory",
      "LinkMemory",
    ]);
  });
});

describe("memory unknown tool detection", () => {
  test("detects common unknown tool error messages", () => {
    expect(isUnknownToolError("unknown tool: update_content")).toBe(true);
    expect(isUnknownToolError("method not found")).toBe(true);
    expect(isUnknownToolError("timeout while calling tool")).toBe(false);
  });
});
