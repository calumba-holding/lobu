import type Redis from "ioredis";
import type { StateAdapter } from "chat";

export async function createGatewayStateAdapter(
  redis: Redis
): Promise<StateAdapter> {
  const { createIoRedisState } = await import("@chat-adapter/state-ioredis");
  return createIoRedisState({
    client: redis,
    keyPrefix: "chat-conn",
    logger: "warn",
  } as any) as StateAdapter;
}
