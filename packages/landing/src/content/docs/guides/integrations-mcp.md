---
title: Integrations & MCP
description: How OAuth/API integrations and MCP servers work in Lobu.
---

Lobu supports two types of external service connections: OAuth/API-key integrations and MCP servers.

## Integrations

Integrations provide authenticated API access (for example Google or custom API-key integrations).

- Worker requests actions through internal gateway endpoints.
- Gateway injects credentials and executes calls.
- Worker receives results, not long-lived secret material.

## MCP Servers

MCP servers add tool capabilities to agents.

- MCP config is resolved by gateway and delivered to workers.
- HTTP/SSE MCP traffic can be proxied through gateway.
- OAuth for MCP is handled by gateway callback flows.

## Why This Model

- Centralizes auth and secret handling
- Keeps workers execution-focused
- Enforces consistent network and domain controls
