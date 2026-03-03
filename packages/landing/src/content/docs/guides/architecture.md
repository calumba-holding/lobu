---
title: Architecture
description: End-to-end request flow across gateway, worker, tools, and platforms.
---

Lobu runs as a gateway + worker architecture.

## Request Flow

1. User sends a message from Slack, Telegram, WhatsApp, or API.
2. Gateway receives it, resolves agent settings, and routes a job.
3. A worker executes the prompt using OpenClaw runtime.
4. Worker uses tools/MCP through gateway-controlled paths.
5. Gateway streams output back to the platform thread.

## Runtime Boundaries

- **Gateway**: orchestration, OAuth, secrets, domain policy, routing.
- **Worker**: model execution, tools, workspace state.
- **Redis**: queue/state backing for job flow.

## Security-Critical Path

- Workers do not directly own global provider secrets.
- Outbound access is controlled via gateway proxy and domain policy.
- Integrations and MCP credentials are handled by the gateway.
