import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { type LobuTomlConfig, lobuConfigSchema } from "./schema.js";

export const CONFIG_FILENAME = "lobu.toml";

export interface LoadResult {
  config: LobuTomlConfig;
  path: string;
}

export interface LoadError {
  error: string;
  details?: string[];
}

/**
 * Load and validate lobu.toml from a directory.
 */
export async function loadConfig(cwd: string): Promise<LoadResult | LoadError> {
  const configPath = join(cwd, CONFIG_FILENAME);

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    return {
      error: `No ${CONFIG_FILENAME} found in ${cwd}`,
      details: ["Run `lobu init` to create one."],
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseToml(raw) as Record<string, unknown>;
  } catch (err) {
    return {
      error: `Invalid TOML syntax in ${CONFIG_FILENAME}`,
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  const result = lobuConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    return { error: `Invalid ${CONFIG_FILENAME}`, details };
  }

  return { config: result.data, path: configPath };
}

export function isLoadError(
  result: LoadResult | LoadError
): result is LoadError {
  return "error" in result;
}

/**
 * Read IDENTITY.md, SOUL.md, USER.md from a directory.
 * Returns content or undefined if file doesn't exist.
 */
export async function loadAgentMarkdown(
  dir: string
): Promise<{ identityMd?: string; soulMd?: string; userMd?: string }> {
  const result: { identityMd?: string; soulMd?: string; userMd?: string } = {};

  const files = [
    { path: "IDENTITY.md", key: "identityMd" as const },
    { path: "SOUL.md", key: "soulMd" as const },
    { path: "USER.md", key: "userMd" as const },
  ];

  for (const { path, key } of files) {
    try {
      const content = await readFile(join(dir, path), "utf-8");
      if (content.trim()) {
        result[key] = content.trim();
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return result;
}

/**
 * Scan directories for *.md skill files.
 * Later dirs override earlier dirs (agent-specific overrides shared).
 * Returns array of { name, content } where name is filename without extension.
 */
export async function loadSkillFiles(
  dirs: string[]
): Promise<Array<{ name: string; content: string }>> {
  const skillMap = new Map<string, string>();

  for (const dir of dirs) {
    const resolvedDir = resolve(dir);
    let entries: string[];
    try {
      entries = await readdir(resolvedDir);
    } catch {
      continue; // Directory doesn't exist, skip
    }

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const name = entry.slice(0, -3); // strip .md
      try {
        const content = await readFile(join(resolvedDir, entry), "utf-8");
        if (content.trim()) {
          skillMap.set(name, content.trim());
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return Array.from(skillMap.entries()).map(([name, content]) => ({
    name,
    content,
  }));
}
