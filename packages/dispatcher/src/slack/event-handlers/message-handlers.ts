#!/usr/bin/env bun

import type { App } from "@slack/bolt";
import logger from "../../logger";
import { type EventHandlerContext, setupEventHandlers } from "./utils";

/**
 * Message-related event handlers
 */

/**
 * Handle message changes (edits)
 */
async function handleMessageChanged({ event }: EventHandlerContext) {
  // For now, just log the event
  // TODO: Handle message edits appropriately - may need to update or recreate worker sessions
  logger.info(`Message changed: ${JSON.stringify(event, null, 2)}`);
}

/**
 * Handle message deletions
 */
async function handleMessageDeleted({ event }: EventHandlerContext) {
  // For now, just log the event
  // TODO: Handle message deletions appropriately - may need to stop/cleanup worker sessions
  logger.info(`Message deleted: ${JSON.stringify(event, null, 2)}`);
}

/**
 * Setup message-related event handlers
 */
export function setupMessageHandlers(app: App) {
  setupEventHandlers(app, {
    message_changed: handleMessageChanged,
    message_deleted: handleMessageDeleted,
  });
}
