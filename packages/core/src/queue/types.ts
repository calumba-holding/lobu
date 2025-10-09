/**
 * Message queue interface for peerbot
 * Supports multiple queue backends (currently Redis via BullMQ)
 */

export interface QueueJob<T = any> {
  id: string;
  data: T;
  name?: string;
}

export interface QueueOptions {
  priority?: number;
  retryLimit?: number;
  retryDelay?: number;
  expireInSeconds?: number;
  singletonKey?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<void>;

/**
 * Abstract message queue interface
 * Implementations: RedisQueue (BullMQ)
 */
export interface IMessageQueue {
  /**
   * Start the queue (connect to backend)
   */
  start(): Promise<void>;

  /**
   * Stop the queue (disconnect from backend)
   */
  stop(): Promise<void>;

  /**
   * Create a queue if it doesn't exist
   */
  createQueue(queueName: string): Promise<void>;

  /**
   * Send a message to a queue
   */
  send<T>(queueName: string, data: T, options?: QueueOptions): Promise<string>;

  /**
   * Subscribe to a queue and process jobs
   */
  work<T>(queueName: string, handler: JobHandler<T>): Promise<void>;

  /**
   * Get queue size/statistics
   */
  getQueueSize(queueName: string): Promise<number>;

  /**
   * Get detailed queue statistics
   */
  getQueueStats(queueName: string): Promise<QueueStats>;

  /**
   * Check if queue is healthy/connected
   */
  isHealthy(): boolean;

  /**
   * Get underlying Redis client for general-purpose Redis operations
   * Used for application state storage (sessions, cache, etc.)
   */
  getRedisClient(): any;
}
