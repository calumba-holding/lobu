// Dispatcher-specific metadata types
// Note: Core types like OrchestratorConfig, QueueJobData are in @peerbot/core

export interface PlatformMetadata {
  teamId?: string;
  originalMessageTs?: string;
  botResponseTs?: string;
}

export interface RoutingMetadata {
  targetThreadId?: string;
  deploymentName?: string;
  threadId?: string;
  userId?: string;
  timestamp?: string;
}

// Re-export from shared package for convenience
export type {
  ErrorCode,
  OrchestratorConfig,
  OrchestratorError,
  QueueJobData,
} from "@peerbot/core";
