const fs = require("node:fs");

// Copy templates
const src = "src/templates";
const dest = "dist/templates";
if (fs.existsSync(src)) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
}

// Copy mcp-servers.json
const jsonSrc = "src/mcp-servers.json";
const jsonDest = "dist/mcp-servers.json";
if (fs.existsSync(jsonSrc)) {
  fs.cpSync(jsonSrc, jsonDest);
}

// Copy system-skills.json from monorepo config
const skillsSrc = "../../config/system-skills.json";
const skillsDest = "dist/system-skills.json";
if (fs.existsSync(skillsSrc)) {
  fs.cpSync(skillsSrc, skillsDest);
}
