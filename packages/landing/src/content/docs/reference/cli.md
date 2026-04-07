---
title: CLI Reference
description: Complete reference for the @lobu/cli command-line tool.
sidebar:
  order: 0
---

The Lobu CLI (`@lobu/cli`) scaffolds projects, runs agents locally, and manages deployments.

## Install

```bash
# Run directly (no install)
npx @lobu/cli <command>

# Or install globally
npm install -g @lobu/cli
lobu <command>
```

## Commands

### `init [name]`

Scaffold a new agent project with `lobu.toml`, Docker Compose, and environment config.

```bash
npx @lobu/cli init my-agent
```

Generates:

- `lobu.toml` — agent configuration (skills, providers, connections, network)
- `docker-compose.yml` — service definitions (gateway, Redis, optional Owletto)
- `.env` — credentials and environment variables
- `agents/{name}/` — agent directory with `IDENTITY.md`, `SOUL.md`, `USER.md`, and `skills/`
- `skills/` — shared skills directory (available to all agents)
- `AGENTS.md`, `TESTING.md`, `README.md`, `.gitignore`
- `Dockerfile.worker` — worker image customization (Docker mode only)

Interactive prompts guide you through deployment mode, provider, skills, platform, and memory configuration.

---

### `run`

Run the agent stack. Validates `lobu.toml`, prepares environment variables, then starts `docker compose up`. Extra flags are forwarded to Docker Compose.

```bash
npx @lobu/cli run -d          # detached mode
npx @lobu/cli run -d --build  # rebuild containers
```

---

### `validate`

Validate `lobu.toml` schema, skill IDs, and provider configuration.

```bash
npx @lobu/cli validate
```

Returns exit code `1` if validation fails.

---

### `login`

Authenticate with a remote Lobu gateway. Opens a browser for OAuth by default.

```bash
npx @lobu/cli login
npx @lobu/cli login --token <api-token>   # CI/CD
```

Options:

| Flag | Description |
|------|-------------|
| `--token <token>` | Use an API token directly (for CI/CD pipelines) |

---

### `logout`

Clear stored credentials.

```bash
npx @lobu/cli logout
```

---

### `whoami`

Show the current authenticated user and linked agent.

```bash
npx @lobu/cli whoami
```

---

### `status`

Show agent health and version info.

```bash
npx @lobu/cli status
```

---

### `secrets`

Manage agent secrets (stored in `.env` for local dev).

```bash
npx @lobu/cli secrets set OPENAI_API_KEY sk-...
npx @lobu/cli secrets list
npx @lobu/cli secrets delete OPENAI_API_KEY
```

| Subcommand | Description |
|------------|-------------|
| `set <key> <value>` | Set a secret |
| `list` | List secrets (values redacted) |
| `delete <key>` | Remove a secret |

---

### `skills`

Browse and manage skills from the registry.

```bash
npx @lobu/cli skills list                # browse all skills
npx @lobu/cli skills search "calendar"   # search by name or description
npx @lobu/cli skills info google-workspace  # show details and required secrets
npx @lobu/cli skills add google-workspace   # add to lobu.toml
```

| Subcommand | Description |
|------------|-------------|
| `list` | Browse the skill registry |
| `search <query>` | Search skills by name or description |
| `info <id>` | Show skill details and required secrets |
| `add <id>` | Add a skill to `lobu.toml` |

---

### `providers`

Browse and manage LLM providers.

```bash
npx @lobu/cli providers list       # browse available providers
npx @lobu/cli providers add gemini  # add to lobu.toml
```

| Subcommand | Description |
|------------|-------------|
| `list` | Browse available LLM providers |
| `add <id>` | Add a provider to `lobu.toml` |

## Typical workflow

```bash
# 1. Scaffold
npx @lobu/cli init my-agent

# 2. Configure
cd my-agent
npx @lobu/cli skills add google-workspace
npx @lobu/cli providers add gemini
npx @lobu/cli secrets set GEMINI_API_KEY ...

# 3. Validate
npx @lobu/cli validate

# 4. Run locally
npx @lobu/cli run -d
```
