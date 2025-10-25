/**
 * Shared types for gateway communication
 */

import type { AgentOptions, ThreadResponsePayload } from "@peerbot/core";

/**
 * Platform-specific metadata (e.g., Slack team_id, channel, thread_ts)
 */
export interface PlatformMetadata {
  team_id?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Message payload for agent execution
 */
export interface MessagePayload {
  botId: string;
  userId: string;
  threadId: string;
  platform: string;
  channelId: string;
  messageId: string;
  messageText: string;
  platformMetadata: PlatformMetadata;
  agentOptions: AgentOptions;
  jobId?: string; // Optional job ID from gateway
  routingMetadata?: {
    targetThreadId: string;
    userId: string;
  };
}

/**
 * Queued message with timestamp
 */
export interface QueuedMessage {
  payload: MessagePayload;
  timestamp: number;
}

/**
 * Response data sent back to gateway
 */
export type ResponseData = ThreadResponsePayload & {
  originalMessageId: string;
};
