---
title: Observability
description: Distributed tracing, logging, and error monitoring for Lobu deployments.
---

Lobu includes built-in observability through OpenTelemetry tracing (Grafana Tempo), structured logging (Loki-compatible), and error monitoring (Sentry).

## Distributed tracing

Lobu uses [OpenTelemetry](https://opentelemetry.io/) to trace messages end-to-end across the gateway and worker. Traces are exported to [Grafana Tempo](https://grafana.com/oss/tempo/) and visualized as waterfall timelines in Grafana.

### What gets traced

Each incoming message creates a root span that propagates through the full pipeline:

1. **message_received** — gateway ingests message from platform
2. **queue_processing** — message consumer picks up the job
3. **worker_creation** — gateway creates worker container/pod
4. **pvc_setup** — persistent volume setup (Kubernetes only)
5. **job_received** — worker receives the job
6. **agent_execution** — OpenClaw agent runs the prompt

Spans are linked via W3C `traceparent` headers, so a single trace ID connects gateway and worker activity.

### Trace ID format

Each message gets a trace ID in the format `tr-{messageId}-{timestamp}-{random}` (e.g., `tr-abc12345-lx4k-a3b2`). This ID appears in logs and can be used to look up the full trace in Grafana.

### Enable tracing

Set the `TEMPO_ENDPOINT` environment variable. Tracing is automatically disabled when this variable is unset.

```bash
# .env
TEMPO_ENDPOINT=http://tempo:4318/v1/traces
```

Both gateway and worker initialize tracing on startup when this is set. The gateway passes the endpoint to workers automatically.

### Docker setup

Add a Tempo service to your `docker-compose.yml`:

```yaml
tempo:
  image: grafana/tempo:latest
  command: ["-config.file=/etc/tempo.yaml"]
  volumes:
    - ./tempo.yaml:/etc/tempo.yaml
    - tempo-data:/var/tempo
  ports:
    - "4318:4318"   # OTLP HTTP
    - "3200:3200"   # Tempo query API

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_AUTH_ANONYMOUS_ENABLED=true
    - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
  volumes:
    - grafana-data:/var/lib/grafana

volumes:
  tempo-data:
  grafana-data:
```

Minimal `tempo.yaml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: "0.0.0.0:4318"

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces

metrics_generator:
  storage:
    path: /var/tempo/metrics
```

Then add `TEMPO_ENDPOINT=http://tempo:4318/v1/traces` to your `.env` and restart.

### Kubernetes setup

Enable Tempo in your Helm values:

```yaml
tempo:
  enabled: true
  tempo:
    storage:
      trace:
        backend: local
        local:
          path: /var/tempo/traces
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: "0.0.0.0:4317"
          http:
            endpoint: "0.0.0.0:4318"
  persistence:
    enabled: true
    size: 10Gi

grafana:
  enabled: true
  namespace: "monitoring"
  lokiUrl: "http://loki:3100"
```

The Helm chart automatically:
- Configures Tempo and Loki datasources in Grafana with cross-linking (logs ↔ traces)
- Deploys the "Lobu Message Traces" dashboard

### Grafana dashboard

The built-in dashboard (`charts/lobu/grafana-dashboard.json`) provides:

- **Messages processed per minute** — throughput time series
- **Recent stage completions** — table of recent traces with stage and duration
- **Stage timeline** — per-trace waterfall showing duration by stage
- **Trace details** — full log view for a selected trace
- **Errors** — filtered error logs

Filter by trace ID prefix (e.g., `tr-abc`) to drill into a specific conversation.

## Logging

Lobu uses a console logger by default (unbuffered, 12-factor compliant). Logs are structured for easy parsing by Loki or any log aggregator.

### Environment variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `LOG_LEVEL` | `error`, `warn`, `info`, `debug` | `info` | Minimum log level |
| `LOG_FORMAT` | `json`, `text` | `text` | Output format. Use `json` for Loki/Grafana |
| `USE_WINSTON_LOGGER` | `true`, `false` | `false` | Enable Winston logger for file rotation and multiple transports |

### Log format

**Text** (default, development):
```
[2025-01-15 14:30:22] [info] [gateway] Processing message {"traceId":"tr-abc12345-lx4k-a3b2"}
```

**JSON** (production, Loki-friendly):
```json
{"timestamp":"2025-01-15T14:30:22.123Z","level":"info","service":"gateway","message":"Processing message","traceId":"tr-abc12345-lx4k-a3b2"}
```

### Viewing logs

```bash
# Docker
docker compose -f docker/docker-compose.yml logs -f gateway

# Kubernetes
kubectl logs -f deployment/lobu-gateway -n lobu
```

## Error monitoring (Sentry)

Lobu integrates with [Sentry](https://sentry.io/) for error and warning capture.

### Enable Sentry

```bash
# .env
SENTRY_DSN=https://your-dsn@sentry.io/your-project
```

When set, errors and warnings from both gateway and worker are automatically sent to Sentry with:
- Console log integration (captures `log`, `warn`, `error`)
- Redis integration for queue-related errors
- 100% trace sample rate for full visibility

If `SENTRY_DSN` is not set, Sentry falls back to the community DSN for basic error reporting.

## Environment variable summary

| Variable | Component | Description |
|----------|-----------|-------------|
| `TEMPO_ENDPOINT` | Gateway, Worker | OTLP HTTP endpoint for Tempo (e.g., `http://tempo:4318/v1/traces`) |
| `SENTRY_DSN` | Gateway, Worker | Sentry DSN for error monitoring |
| `LOG_LEVEL` | Gateway, Worker | Minimum log level (`error`, `warn`, `info`, `debug`) |
| `LOG_FORMAT` | Gateway, Worker | Log output format (`json` or `text`) |
| `USE_WINSTON_LOGGER` | Gateway, Worker | Enable Winston logger (`true`/`false`) |
