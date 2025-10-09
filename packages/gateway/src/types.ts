#!/usr/bin/env bun

import type { ClaudeExecutionOptions } from "@peerbot/core";
import type { LogLevel } from "@slack/bolt";

export interface SlackConfig {
  token: string;
  appToken?: string;
  signingSecret?: string;
  socketMode?: boolean;
  port?: number;
  botUserId?: string;
  botId?: string;
  allowedUsers?: string[];
}

export interface QueueConfig {
  directMessage: string;
  messageQueue: string;
  connectionString: string;
  retryLimit?: number;
  retryDelay?: number;
  expireInHours?: number;
}

export interface DispatcherConfig {
  slack: SlackConfig;
  claude: Partial<ClaudeExecutionOptions>;
  sessionTimeoutMinutes: number;
  logLevel?: LogLevel;
  queues: QueueConfig;
  anthropicProxy: import("./proxy/anthropic-proxy").AnthropicProxyConfig;
}

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

export interface ThreadSession {
  sessionKey: string;
  threadTs?: string;
  channelId: string;
  userId: string;
  threadCreator?: string; // Track the original thread creator
  jobName?: string;
  lastActivity: number;
  status:
    | "pending"
    | "starting"
    | "running"
    | "completed"
    | "error"
    | "timeout";
  createdAt: number;
  botResponseTs?: string; // Bot's response message timestamp for updates
  messageReactions?: Map<string, string>; // Track reactions per message (messageTs -> reaction)
}

// Slack Event Types - properly typed to replace 'any'
export interface SlackUser {
  id: string;
  name: string;
  display_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
    email?: string;
  };
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  channel_type?: string;
  team?: string;
  user_profile?: {
    display_name?: string;
    real_name?: string;
  };
}

export interface SlackAppMentionEvent extends SlackMessage {
  type: "app_mention";
}

export interface SlackBlock {
  type: string;
  block_id?: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: SlackBlockElement[];
  accessory?: SlackBlockElement;
}

export interface SlackBlockElement {
  type: string;
  action_id?: string;
  text?: {
    type: string;
    text: string;
  };
  value?: string;
  style?: string;
  url?: string;
}

export interface SlackAction {
  type: string;
  action_id: string;
  block_id?: string;
  text?: {
    type: string;
    text: string;
  };
  value?: string;
  style?: string;
  action_ts?: string;
}

export interface SlackActionBody {
  type: string;
  user: SlackUser;
  team: {
    id: string;
    domain: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  message?: {
    type: string;
    text: string;
    ts: string;
    thread_ts?: string;
    blocks?: SlackBlock[];
  };
  container?: {
    type: string;
    message_ts: string;
    channel_id: string;
    is_ephemeral: boolean;
  };
  trigger_id: string;
  actions: SlackAction[];
  response_url?: string;
  view?: SlackView;
}

export interface SlackView {
  id: string;
  team_id: string;
  type: string;
  blocks: SlackBlock[];
  private_metadata?: string;
  callback_id?: string;
  state?: {
    values: Record<string, Record<string, SlackStateValue>>;
  };
  hash?: string;
  title?: {
    type: string;
    text: string;
  };
  submit?: {
    type: string;
    text: string;
  };
  close?: {
    type: string;
    text: string;
  };
}

export interface SlackStateValue {
  type: string;
  value?: string;
  selected_option?: {
    text: {
      type: string;
      text: string;
    };
    value: string;
  };
  selected_options?: Array<{
    text: {
      type: string;
      text: string;
    };
    value: string;
  }>;
  selected_date?: string;
  selected_time?: string;
  selected_date_time?: number;
}

export interface SlackViewSubmissionBody {
  type: "view_submission";
  team: {
    id: string;
    domain: string;
  };
  user: SlackUser;
  view: SlackView;
  trigger_id: string;
  response_urls?: Array<{
    block_id: string;
    action_id: string;
    channel_id: string;
    response_url: string;
  }>;
}

export interface SlackAppHomeEvent {
  type: "app_home_opened";
  user: string;
  channel: string;
  tab: "home" | "messages";
  event_ts: string;
}

export interface SlackTeamJoinEvent {
  type: "team_join";
  user: SlackUser;
}

export interface SlackFileSharedEvent {
  type: "file_shared";
  file_id: string;
  user_id: string;
  file: {
    id: string;
    name?: string;
    title?: string;
    mimetype?: string;
    filetype?: string;
    url_private?: string;
    url_private_download?: string;
  };
  channel_id?: string;
  event_ts: string;
}

// Module action context
export interface ModuleActionContext {
  channelId: string;
  client: any; // WebClient from @slack/web-api
  body: SlackActionBody;
  updateAppHome: (userId: string, client: any) => Promise<void>;
  messageHandler: {
    handleUserRequest: (
      context: SlackContext,
      userRequest: string,
      client: any
    ) => Promise<void>;
  };
}
