import type Redis from "ioredis";
import { safeJsonParse, safeJsonStringify } from "../utils/json";

export type RedisJsonClient = Pick<
  Redis,
  "get" | "getdel" | "set" | "setex" | "mget" | "scan"
>;

function serializeJson<T>(value: T): string {
  const serialized = safeJsonStringify(value);
  if (serialized === null) {
    throw new Error("Failed to serialize value to JSON");
  }
  return serialized;
}

export async function getJsonValue<T>(
  redis: Pick<Redis, "get">,
  key: string
): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return safeJsonParse<T>(raw);
}

export async function getdelJsonValue<T>(
  redis: Pick<Redis, "getdel">,
  key: string
): Promise<T | null> {
  const raw = await redis.getdel(key);
  if (!raw) return null;
  return safeJsonParse<T>(raw);
}

export async function setJsonValue<T>(
  redis: Pick<Redis, "set" | "setex">,
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const serialized = serializeJson(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.setex(key, ttlSeconds, serialized);
    return;
  }
  await redis.set(key, serialized);
}

export async function mgetJsonValues<T>(
  redis: Pick<Redis, "mget">,
  keys: string[]
): Promise<Array<T | null>> {
  if (keys.length === 0) return [];
  const rawValues = await redis.mget(...keys);
  return rawValues.map((raw) => (raw ? safeJsonParse<T>(raw) : null));
}

export async function scanKeysByPattern(
  redis: Pick<Redis, "scan">,
  pattern: string,
  count: number = 100
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      count
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}
