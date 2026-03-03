---
title: REST API
description: Programmatic access to Lobu agents through HTTP endpoints.
---

Lobu exposes HTTP APIs so you can trigger agents and integrate with external systems.

## Features

- **Messaging endpoint** to send messages to agents over `api`, `slack`, `telegram`, and internal platform routes.
- **Bearer token authentication** for API access control.
- **Multipart file upload support** with per-file and total-size limits.
- **OpenAPI-documented routes** for schema-driven integrations.
- **Platform-aware routing fields** (for example Slack channel/thread metadata).

## Typical Use Cases

- Connect backend workflows to an agent programmatically.
- Trigger agent tasks from webhooks, cron jobs, or internal services.
- Build custom UI clients on top of Lobu's gateway API.
