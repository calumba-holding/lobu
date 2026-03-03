---
title: Comparison
description: How Lobu differs from OpenClaw and how Lobu uses the OpenClaw runtime.
---

Lobu and OpenClaw are complementary, but they solve different layers of the problem.

- OpenClaw provides the agent runtime/engine.
- Lobu provides deployment, orchestration, isolation, and multi-platform delivery around that runtime.

## How Lobu Uses OpenClaw Runtime

Inside each worker, Lobu runs OpenClaw sessions and tool execution.

Lobu wraps OpenClaw with platform and infrastructure concerns:

1. Gateway receives user messages (Slack/Telegram/WhatsApp/API).
2. Gateway routes jobs to worker runtime instances.
3. Worker executes with OpenClaw using Lobu's tool policy and workspace model.
4. Gateway streams responses and manages integrations/OAuth/secrets.

So the AI execution engine is OpenClaw, while Lobu is the operating layer around it.

## Lobu vs OpenClaw

| Capability | Lobu | OpenClaw |
|---|---|---|
| Runtime engine | Uses OpenClaw in workers | Native OpenClaw runtime |
| Multi-platform delivery | Built-in (Slack, Telegram, WhatsApp, API) | Integrations available, but no Lobu gateway model |
| Worker isolation | Sandboxed worker model + gateway proxy | Not the same built-in gateway isolation model |
| Secret handling | Centralized in gateway/proxy | Direct runtime usage depends on setup |
| Egress control | Domain policy through gateway proxy | Depends on host/network setup |
| Deployment model | Docker or Kubernetes orchestration | Typically single runtime deployment |

## Why This Split Matters

Using Lobu with OpenClaw gives you:

- OpenClaw's agent runtime capabilities
- Lobu's production concerns: isolation, routing, persistence, multi-tenant operations, and controlled network/auth boundaries
