#!/usr/bin/env node

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function rewriteWorkspaceDeps(pkg, workspaceVersions) {
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  for (const section of sections) {
    const deps = pkg[section];
    if (!deps) continue;

    for (const [depName, spec] of Object.entries(deps)) {
      if (typeof spec !== "string" || !spec.startsWith("workspace:")) continue;

      const version = workspaceVersions.get(depName);
      if (!version) {
        throw new Error(
          `Cannot resolve workspace dependency "${depName}" for ${pkg.name}`
        );
      }

      const suffix = spec.slice("workspace:".length);
      if (suffix === "*" || suffix === "") {
        deps[depName] = version;
      } else if (suffix === "^" || suffix === "~") {
        deps[depName] = `${suffix}${version}`;
      } else {
        deps[depName] = suffix;
      }
    }
  }
}

function sourceToDistPath(spec) {
  if (typeof spec !== "string" || !spec.startsWith("./src/")) return spec;
  return spec.replace("./src/", "./dist/").replace(/\.([cm]?ts|tsx)$/u, ".js");
}

function rewriteExportsForPublish(exportsField) {
  if (!exportsField || typeof exportsField !== "object") return;

  for (const value of Object.values(exportsField)) {
    if (!value || typeof value !== "object") continue;

    if ("bun" in value && typeof value.bun === "string") {
      value.bun = sourceToDistPath(value.bun);
    }

    rewriteExportsForPublish(value);
  }
}

function collectPublishEntries(pkg) {
  const entries = new Set(["package.json"]);
  const includeIfExists = ["README.md", "README", "LICENSE", "LICENSE.md"];

  for (const candidate of includeIfExists) {
    entries.add(candidate);
  }

  if (Array.isArray(pkg.files) && pkg.files.length > 0) {
    for (const entry of pkg.files) {
      entries.add(entry);
    }
  } else {
    entries.add("dist");
    if (pkg.bin) {
      for (const binPath of Object.values(pkg.bin)) {
        entries.add(binPath);
      }
    }
  }

  return Array.from(entries);
}

async function main() {
  const [packageArg, outputArg] = process.argv.slice(2);
  if (!packageArg || !outputArg) {
    throw new Error(
      "Usage: node scripts/stage-publish-package.mjs <package-dir> <output-dir>"
    );
  }

  const repoRoot = process.cwd();
  const packageDir = path.resolve(repoRoot, packageArg);
  const outputDir = path.resolve(repoRoot, outputArg);
  const rootPackageJsonPath = path.join(repoRoot, "package.json");
  const rootPackage = await readJson(rootPackageJsonPath);
  const packageJsonPath = path.join(packageDir, "package.json");
  const pkg = await readJson(packageJsonPath);

  const workspaceVersions = new Map();
  for (const workspacePath of rootPackage.workspaces ?? []) {
    const workspacePackageJson = path.join(
      repoRoot,
      workspacePath,
      "package.json"
    );
    if (!(await exists(workspacePackageJson))) continue;
    const workspacePkg = await readJson(workspacePackageJson);
    if (workspacePkg.name && workspacePkg.version) {
      workspaceVersions.set(workspacePkg.name, workspacePkg.version);
    }
  }

  rewriteWorkspaceDeps(pkg, workspaceVersions);
  rewriteExportsForPublish(pkg.exports);

  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputDir, { recursive: true });

  for (const relativeEntry of collectPublishEntries(pkg)) {
    const sourcePath = path.join(packageDir, relativeEntry);
    if (!(await exists(sourcePath))) continue;
    const targetPath = path.join(outputDir, relativeEntry);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }

  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf8"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
