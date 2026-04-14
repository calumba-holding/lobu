import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOwlettoMemoryEnvFromProject } from "../config/file-loader";

const originalMemoryUrl = process.env.MEMORY_URL;

function restoreMemoryUrl(): void {
  if (originalMemoryUrl === undefined) {
    delete process.env.MEMORY_URL;
  } else {
    process.env.MEMORY_URL = originalMemoryUrl;
  }
}

describe("applyOwlettoMemoryEnvFromProject", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "lobu-file-loader-memory-"));
    mkdirSync(join(projectDir, "agents", "support"), { recursive: true });
    delete process.env.MEMORY_URL;
  });

  afterEach(() => {
    restoreMemoryUrl();
    rmSync(projectDir, { recursive: true, force: true });
  });

  function writeProject(memoryBlock: string, owlettoYaml?: string): void {
    writeFileSync(
      join(projectDir, "lobu.toml"),
      `
[agents.support]
name = "support"
dir = "./agents/support"

${memoryBlock}
`,
      "utf-8"
    );

    if (owlettoYaml !== undefined) {
      writeFileSync(join(projectDir, "owletto.yaml"), owlettoYaml, "utf-8");
    }
  }

  test("derives a hosted scoped MCP URL from [memory.owletto]", async () => {
    writeProject(
      `[memory.owletto]
enabled = true
config = "./owletto.yaml"
`,
      `version: 1
org: careops
`
    );

    const memoryUrl = await applyOwlettoMemoryEnvFromProject(projectDir);

    expect(memoryUrl).toBe("https://owletto.com/mcp/careops");
    expect(process.env.MEMORY_URL).toBe("https://owletto.com/mcp/careops");
  });

  test("uses MEMORY_URL as the base endpoint before scoping to the project org", async () => {
    process.env.MEMORY_URL = "https://memory.example.com/mcp";
    writeProject(
      `[memory.owletto]
enabled = true
config = "./owletto.yaml"
`,
      `version: 1
org: careops
`
    );

    const memoryUrl = await applyOwlettoMemoryEnvFromProject(projectDir);

    expect(memoryUrl).toBe("https://memory.example.com/mcp/careops");
    expect(process.env.MEMORY_URL).toBe(
      "https://memory.example.com/mcp/careops"
    );
  });

  test("does nothing when [memory.owletto] is disabled", async () => {
    process.env.MEMORY_URL = "https://memory.example.com/mcp";
    writeProject(
      `[memory.owletto]
enabled = false
config = "./owletto.yaml"
`,
      `version: 1
org: careops
`
    );

    const memoryUrl = await applyOwlettoMemoryEnvFromProject(projectDir);

    expect(memoryUrl).toBeNull();
    expect(process.env.MEMORY_URL).toBe("https://memory.example.com/mcp");
  });
});
