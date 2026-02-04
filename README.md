# Termos

**Agent orchestration for messaging platforms.** Run AI coding agents (Claude Code, Codex, OpenClaw) in sandboxed containers, accessible via Slack, WhatsApp, or API.

## Try It Now

**No setup required** - chat with our hosted agents:

- **WhatsApp**: Message [+44 7512 972810](https://wa.me/447512972810)
- **Slack**: Join our [workspace](https://join.slack.com/t/peerbot/shared_invite/zt-391o8tyw2-iyupjTG1xHIz9Og8C7JOnw)

## How It Works

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Slack/WhatsApp │────▶│   Gateway   │────▶│  Worker (Agent)  │
│     Thread      │◀────│             │◀────│  Claude Code     │
└─────────────────┘     └──────┬──────┘     └──────────────────┘
                               │
                        ┌──────▼──────┐
                        │    Redis    │
                        │   (state)   │
                        └─────────────┘
```

**Key concepts:**

- **Session = Thread** - Each conversation thread gets its own isolated agent container
- **Short-lived tokens** - Platform/channel-specific tokens shared with workers for secure API access
- **Persistent volumes** - Container workspaces survive restarts and scale-to-zero events
- **Network isolation** - Workers run in sandboxed networks with configurable domain allowlists

## Deployment Modes

| Mode | Use Case | Orchestration |
|------|----------|---------------|
| **Kubernetes** | Production | Helm chart, auto-scaling, PVCs |
| **Docker** | Development | Docker Compose, local volumes |
| **Local** | Testing | Child processes, sandbox runtime |

## Quick Start (Self-Hosted)

```bash
# Create a new bot
npm create termos my-bot

# Configure and start
cd my-bot
cp .env.example .env  # Add your tokens
npm run dev
```

## API

Full API documentation: [termos.dev/api](https://termos.dev/api)

### Start a Session

```bash
curl -X POST https://your-gateway/api/v1/agents/{agentId}/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a Python script that...", "model": "claude-sonnet-4-20250514"}'
```

### Configuration Options

```json
{
  "prompt": "Your task...",
  "model": "claude-sonnet-4-20250514",
  "workingDirectory": "/workspace/project",
  "networkConfig": {
    "allowedDomains": ["github.com", "api.openai.com"]
  },
  "mcpConfig": {
    "servers": { ... }
  }
}
```

## Architecture

### Gateway
- Manages platform connections (Slack Socket Mode, WhatsApp Baileys)
- Routes messages to worker containers
- Handles OAuth flows for MCP servers
- Streams responses back to users

### Workers
- Isolated containers running AI agents
- Currently supports Claude Code CLI
- Future: Codex, OpenClaw, custom agents
- MCP server support with OAuth proxy

### Session Management
- Redis-backed state persistence
- Thread-to-session mapping
- Automatic cleanup of idle sessions
- Turn counting to prevent infinite loops

## Features

- **Multi-platform** - Slack, WhatsApp, REST API
- **Sandboxed execution** - Network isolation, domain allowlists
- **Persistent workspaces** - Git repos, files survive restarts
- **MCP OAuth** - Authenticate external services via home tab
- **Custom workers** - Extend base image with your tools

## Worker Customization

```dockerfile
FROM buremba/termos-worker-base:latest

# Add your tools
RUN pip install pandas matplotlib
RUN apt-get update && apt-get install -y postgresql-client

# Add custom instructions
COPY CLAUDE.md /workspace/
```

## Self-Hosting

### Requirements

- Redis (for state and queues)
- Docker or Kubernetes
- Platform tokens (Slack Bot/App tokens, or WhatsApp session)

### Environment Variables

```bash
# Required
QUEUE_URL=redis://localhost:6379
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# Optional
DEPLOYMENT_MODE=kubernetes|docker|local
WORKER_ALLOWED_DOMAINS=github.com,api.example.com
PUBLIC_GATEWAY_URL=https://your-domain.com
```

### Kubernetes Deployment

```bash
helm repo add termos https://charts.termos.dev
helm install termos termos/termos -f values.yaml
```

## Contributing

```bash
# Clone and install
git clone https://github.com/termos-dev/termos
cd termos && bun install

# Development
make dev              # Start gateway
./scripts/test-bot.sh "@me hello"  # Test

# Run tests
bun run test
```

## Packages

**NPM:**
- [`create-termos`](https://www.npmjs.com/package/create-termos) - CLI for creating new bots
- [`@termosdev/worker`](https://www.npmjs.com/package/@termosdev/worker) - Worker runtime
- [`@termosdev/gateway`](https://www.npmjs.com/package/@termosdev/gateway) - Gateway server
- [`@termosdev/core`](https://www.npmjs.com/package/@termosdev/core) - Shared utilities

**Docker Hub:**
- [`buremba/termos-gateway`](https://hub.docker.com/r/buremba/termos-gateway)
- [`buremba/termos-worker-base`](https://hub.docker.com/r/buremba/termos-worker-base)

## License

Apache 2.0
