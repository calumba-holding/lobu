import { describe, expect, mock, test } from "bun:test";
import { ChatInstanceManager } from "../connections/chat-instance-manager";

class PipelineRedisMock {
  private readonly operations: Array<() => Promise<unknown>> = [];

  constructor(private readonly redis: RedisMock) {}

  set(key: string, value: string): this {
    this.operations.push(() => this.redis.set(key, value));
    return this;
  }

  sadd(key: string, member: string): this {
    this.operations.push(() => this.redis.sadd(key, member));
    return this;
  }

  async exec(): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const operation of this.operations) {
      results.push(await operation());
    }
    return results;
  }
}

class RedisMock {
  private readonly strings = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.strings.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      const existed = this.strings.delete(key) || this.sets.delete(key);
      if (existed) {
        removed++;
      }
    }
    return removed;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }

    const set = this.sets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) {
      return 0;
    }

    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) || []);
  }

  pipeline(): PipelineRedisMock {
    return new PipelineRedisMock(this);
  }
}

describe("ChatInstanceManager Slack marketplace support", () => {
  test("ensureSlackWorkspaceConnection is idempotent per team", async () => {
    const manager = new ChatInstanceManager() as any;
    const redis = new RedisMock();
    const startInstance = mock(async (connection: any) => {
      manager.instances.set(connection.id, {
        connection,
        chat: { webhooks: { slack: async () => new Response("ok") } },
        cleanup: async () => undefined,
      });
    });

    manager.redis = redis;
    manager.startInstance = startInstance;
    manager.resolveSlackAdapterConfig = mock(() => ({
      platform: "slack",
      signingSecret: "signing-secret",
      clientId: "client-id",
      clientSecret: "client-secret",
    }));

    const first = await manager.ensureSlackWorkspaceConnection("T123", {
      botToken: "xoxb-first-token",
      botUserId: "U123",
      teamName: "Acme",
    });
    const second = await manager.ensureSlackWorkspaceConnection("T123", {
      botToken: "xoxb-second-token",
      botUserId: "U456",
      teamName: "Acme Updated",
    });

    expect(second.id).toBe(first.id);
    expect(startInstance).toHaveBeenCalledTimes(2);

    const connections = await manager.listConnections({ platform: "slack" });
    expect(connections).toHaveLength(1);

    const stored = JSON.parse(
      (await redis.get(`connection:${first.id}`)) || "{}"
    );
    const decryptedConfig = manager.decryptConfig(stored.config);

    expect(stored.metadata).toEqual({
      teamId: "T123",
      teamName: "Acme Updated",
      botUserId: "U456",
    });
    expect(decryptedConfig.botToken).toBe("xoxb-second-token");
    expect(decryptedConfig.botUserId).toBe("U456");
  });

  test("handleSlackAppWebhook prefers an exact team match", async () => {
    const manager = new ChatInstanceManager() as any;

    manager.findSlackConnectionByTeamId = mock(async (teamId: string) =>
      teamId === "T123" ? { id: "conn-team" } : null
    );
    manager.getDefaultSlackConnection = mock(async () => ({
      id: "conn-default",
    }));
    manager.ensureConnectionRunning = mock(async () => true);
    manager.handleWebhook = mock(
      async (connectionId: string, request: Request) => {
        const body = await request.text();
        return new Response(`${connectionId}:${body}`);
      }
    );

    const body = JSON.stringify({ team_id: "T123", type: "event_callback" });
    const response = await manager.handleSlackAppWebhook(
      new Request("https://gateway.example.com/slack/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`conn-team:${body}`);
    expect(manager.handleWebhook).toHaveBeenCalledTimes(1);
    expect(manager.handleWebhook.mock.calls[0]?.[0]).toBe("conn-team");
  });

  test("handleSlackAppWebhook falls back to the default Slack connection", async () => {
    const manager = new ChatInstanceManager() as any;

    manager.findSlackConnectionByTeamId = mock(async () => null);
    manager.getDefaultSlackConnection = mock(async () => ({
      id: "conn-default",
    }));
    manager.ensureConnectionRunning = mock(async () => true);
    manager.handleWebhook = mock(
      async (connectionId: string, request: Request) => {
        const body = await request.text();
        return new Response(`${connectionId}:${body}`);
      }
    );

    const body = JSON.stringify({ type: "url_verification" });
    const response = await manager.handleSlackAppWebhook(
      new Request("https://gateway.example.com/slack/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`conn-default:${body}`);
    expect(manager.handleWebhook.mock.calls[0]?.[0]).toBe("conn-default");
  });
});
