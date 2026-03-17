import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import chalk from "chalk";

const exec = promisify(execFile);

export async function statusCommand(cwd: string): Promise<void> {
  // Detect project name from .env or fallback
  let projectName: string | undefined;
  try {
    const envContent = await readFile(join(cwd, ".env"), "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("COMPOSE_PROJECT_NAME=")) {
        projectName = trimmed.slice("COMPOSE_PROJECT_NAME=".length);
        if (
          (projectName.startsWith('"') && projectName.endsWith('"')) ||
          (projectName.startsWith("'") && projectName.endsWith("'"))
        ) {
          projectName = projectName.slice(1, -1);
        }
        break;
      }
    }
  } catch {
    // No .env file
  }

  let output: string;
  try {
    const result = await exec("docker", ["compose", "ps", "--format", "json"], {
      cwd,
    });
    output = result.stdout.trim();
  } catch {
    console.log(chalk.yellow("\n  No running containers found."));
    console.log(chalk.dim("  Start with `lobu dev` to run your agents.\n"));
    return;
  }

  if (!output) {
    console.log(chalk.yellow("\n  No running containers found."));
    console.log(chalk.dim("  Start with `lobu dev` to run your agents.\n"));
    return;
  }

  // docker compose ps --format json outputs one JSON object per line
  const containers = output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as {
          Name: string;
          Service: string;
          State: string;
          Status: string;
          Publishers?: Array<{ PublishedPort: number; TargetPort: number }>;
        };
      } catch {
        return null;
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (containers.length === 0) {
    console.log(chalk.yellow("\n  No running containers found."));
    console.log(chalk.dim("  Start with `lobu dev` to run your agents.\n"));
    return;
  }

  console.log(
    chalk.bold.cyan(
      `\n  ${projectName ? `${projectName} — ` : ""}${containers.length} container(s)\n`
    )
  );

  for (const c of containers) {
    const stateIcon = c.State === "running" ? chalk.green("●") : chalk.red("●");
    const ports =
      c.Publishers?.filter((p) => p.PublishedPort > 0)
        .map((p) => `${p.PublishedPort}→${p.TargetPort}`)
        .join(", ") || "";
    const portStr = ports ? chalk.dim(` (${ports})`) : "";

    console.log(
      `  ${stateIcon} ${chalk.bold(c.Service)} ${chalk.dim(c.Status)}${portStr}`
    );
  }

  // Show gateway URL if found
  const gateway = containers.find((c) => c.Service === "gateway");
  if (gateway) {
    const pub = gateway.Publishers?.find(
      (p) => p.PublishedPort > 0 && p.TargetPort === 8080
    );
    if (pub) {
      console.log(
        chalk.cyan(
          `\n  Admin page: http://localhost:${pub.PublishedPort}/agents`
        )
      );
    }
  }

  console.log();
}
