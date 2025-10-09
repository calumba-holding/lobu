/**
 * Message queue exports
 */

export * from "./redis-queue";
export * from "./types";

import { RedisQueue, type RedisQueueConfig } from "./redis-queue";
import type { IMessageQueue } from "./types";

/**
 * Create a message queue instance
 * Currently only supports Redis, but can be extended to support other backends
 */
export function createMessageQueue(connectionString: string): IMessageQueue {
  // Parse Redis connection string
  // Format: redis://[:password@]host:port[/db]
  const url = new URL(connectionString);

  if (url.protocol !== "redis:") {
    throw new Error(
      `Unsupported queue protocol: ${url.protocol}. Only redis:// is supported.`
    );
  }

  const config: RedisQueueConfig = {
    host: url.hostname,
    port: Number.parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
    db: url.pathname ? Number.parseInt(url.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: 3,
  };

  return new RedisQueue(config);
}
