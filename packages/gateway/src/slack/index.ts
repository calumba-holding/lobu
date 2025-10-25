#!/usr/bin/env bun

/**
 * @peerbot/slack
 * Slack platform adapter for Peerbot
 *
 * Exports:
 * - SlackPlatform: Platform adapter for Gateway
 * - SlackInstructionProvider: Instruction provider for Worker
 * - Utilities: Block builders, converters, etc.
 */

// Configuration
export type {
  SlackConfig,
  SlackPlatformConfig,
  AgentOptions,
  MessageHandlerConfig,
} from "./config";

// Platform Adapter
export { SlackPlatform } from "./platform";

// Instruction Provider
export { SlackInstructionProvider } from "./instructions/provider";

// Block Builders and Converters
export { SlackBlockBuilder } from "./converters/block-builder";
export { convertMarkdownToSlack } from "./converters/markdown";
export { extractCodeBlockActions } from "./converters/blockkit";
export type { ModuleButton } from "./converters/block-builder";

// Types
export type {
  // Core types
  SlackContext,
  WebClient,
  AnyBlock,
  Button,
  // View types
  View,
  // Action types
  SlackActionBody,
  // Module types
  ModuleActionContext,
  // Message types
  SlackMessageEvent,
} from "./types";

// Utilities
export { setThreadStatus, isSelfGeneratedEvent } from "./utils";

// Constants
export { SLACK } from "./config";

// Event Handlers (for advanced usage)
export { SlackEventHandlers } from "./event-router";
export { MessageHandler } from "./events/messages";
export { ActionHandler } from "./events/actions";
