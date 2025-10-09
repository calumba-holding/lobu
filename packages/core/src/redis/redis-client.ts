#!/usr/bin/env bun

import { createLogger } from "../logger";

const logger = createLogger("redis-client");

export interface IRedisClient {
  /**
   * Get a value from Redis
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in Redis with optional TTL (seconds)
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a key from Redis
   */
  del(key: string): Promise<void>;

  /**
   * Add to a Redis set
   */
  sadd(key: string, member: string): Promise<void>;

  /**
   * Check if member exists in Redis set
   */
  sismember(key: string, member: string): Promise<boolean>;

  /**
   * Remove from Redis set
   */
  srem(key: string, member: string): Promise<void>;

  /**
   * Close Redis connection
   */
  disconnect(): Promise<void>;
}

/**
 * Redis client wrapper that uses BullMQ's Redis connection
 * This avoids creating multiple Redis connections
 */
export class RedisClient implements IRedisClient {
  private redis: any;

  constructor(redis: any) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.redis.sadd(key, member);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.redis.sismember(key, member);
    return result === 1;
  }

  async srem(key: string, member: string): Promise<void> {
    await this.redis.srem(key, member);
  }

  async disconnect(): Promise<void> {
    // Don't disconnect - BullMQ manages the connection
    logger.debug("RedisClient disconnect called (no-op, managed by BullMQ)");
  }
}
