#!/usr/bin/env bun

/**
 * Slack-specific type definitions
 * Imports and re-exports types from Slack SDK to ensure type safety
 */

// Import SDK types
import type {
  AnyBlock,
  Block,
  BlockElement,
  Button,
  ActionsBlockElement,
  AppMentionEvent,
  AppHomeOpenedEvent,
  TeamJoinEvent,
  FileSharedEvent,
  GenericMessageEvent,
  View,
  ModalView,
  HomeView,
} from "@slack/types";

import type { WebClient } from "@slack/web-api";

import type {
  BlockAction,
  SlackActionMiddlewareArgs,
  SlackEventMiddlewareArgs,
  SlackViewMiddlewareArgs,
} from "@slack/bolt";

// Type aliases for convenience
export type SlackBlock = Block;
export type SlackBlockElement = BlockElement;
export type SlackWebClient = WebClient;

// Re-export SDK types for convenience
export type {
  AnyBlock,
  Button,
  ActionsBlockElement,
  View,
  ModalView,
  HomeView,
};
export type {
  AppMentionEvent,
  AppHomeOpenedEvent,
  TeamJoinEvent,
  FileSharedEvent,
  GenericMessageEvent,
};
export type { WebClient };
export type {
  BlockAction,
  SlackActionMiddlewareArgs,
  SlackEventMiddlewareArgs,
  SlackViewMiddlewareArgs,
};

// App-specific context type (not in SDK)
export interface SlackContext {
  channelId: string;
  userId: string;
  userDisplayName?: string;
  teamId: string;
  threadTs?: string;
  messageTs: string;
  text: string;
  messageUrl?: string;
}

// Helper type for message events (combining GenericMessageEvent with common properties)
export interface SlackMessageEvent extends GenericMessageEvent {
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  channel_type?: string;
  team?: string;
}

// Helper type for action body (from middleware args)
export type SlackActionBody = SlackActionMiddlewareArgs<BlockAction>["body"];

// Helper type for view submission body
export type SlackViewSubmissionBody = SlackViewMiddlewareArgs["body"];

// Module action context (app-specific)
export interface ModuleActionContext {
  channelId: string;
  client: WebClient;
  body: SlackActionBody;
  updateAppHome: (userId: string, client: WebClient) => Promise<void>;
  messageHandler: {
    handleUserRequest: (
      context: SlackContext,
      userRequest: string,
      client: WebClient
    ) => Promise<void>;
  };
}
