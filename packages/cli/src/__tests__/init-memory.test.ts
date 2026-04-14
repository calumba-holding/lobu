import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateDockerCompose,
  generateLobuToml,
  generateOwlettoProjectLayout,
} from "../commands/init";

describe("init memory scaffolding", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "lobu-init-memory-"));
    mkdirSync(join(projectDir, "agents", "support"), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("generateLobuToml writes the [memory.owletto] block when enabled", async () => {
    await generateLobuToml(projectDir, {
      agentName: "support",
      allowedDomains: "github.com,.github.com",
      includeOwlettoMemory: true,
    });

    const content = readFileSync(join(projectDir, "lobu.toml"), "utf-8");

    expect(content).toContain("[memory.owletto]");
    expect(content).toContain('config = "./owletto.yaml"');
    expect(content).toContain('models = "./models"');
    expect(content).toContain('data = "./data"');
  });

  test("generateOwlettoProjectLayout creates the new Owletto structure", async () => {
    await generateOwlettoProjectLayout(projectDir, {
      org: "support",
      name: "Support",
    });

    const owlettoYaml = readFileSync(join(projectDir, "owletto.yaml"), "utf-8");

    expect(owlettoYaml).toContain("version: 1");
    expect(owlettoYaml).toContain("org: support");
    expect(statSync(join(projectDir, "models")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "data", "entities")).isDirectory()).toBe(
      true
    );
    expect(
      statSync(join(projectDir, "data", "relationships")).isDirectory()
    ).toBe(true);
  });

  test("generateDockerCompose keeps MEMORY_URL as an optional base override", () => {
    const content = generateDockerCompose({
      projectName: "support",
      gatewayPort: "8080",
      dockerfilePath: "./Dockerfile.worker",
      deploymentMode: "embedded",
      includeOwlettoLocal: true,
    });

    expect(content).toContain("Optional Owletto base MCP URL override");
    expect(content).toContain("MEMORY_URL: ${MEMORY_URL:-}");
    expect(content).toContain("owletto:");
    expect(content).toContain("owletto-postgres:");
  });
});
