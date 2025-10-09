#!/usr/bin/env bun

export interface WorkerConfig {
  sessionKey: string;
  userId: string;
  channelId: string;
  threadTs?: string;
  userPrompt: string; // Base64 encoded
  slackResponseChannel: string;
  slackResponseTs: string;
  botResponseTs?: string; // Bot's response message timestamp for updates
  claudeOptions: string; // JSON string
  sessionId?: string; // Claude session ID for new sessions
  resumeSessionId?: string; // Claude session ID to resume from
  workspace: {
    baseDirectory: string;
  };
}

export interface WorkspaceSetupConfig {
  baseDirectory: string;
}

export interface WorkspaceInfo {
  baseDirectory: string;
  userDirectory: string;
  setupComplete: boolean;
}

// Re-export from shared package
export { SlackError, WorkerError, WorkspaceError } from "@peerbot/core";
