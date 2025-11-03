#!/usr/bin/env bun

import {
  createLogger,
  type InteractionOptions,
  TIME,
  type UserInteraction,
  type UserSuggestion,
} from "@peerbot/core";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";

const logger = createLogger("interactions");

/**
 * Platform-agnostic interaction service
 * Manages interaction state and emits events for platforms to handle
 */
export class InteractionService extends EventEmitter {
  constructor(private redis: Redis) {
    super();
  }

  /**
   * Create a blocking interaction
   * Stores in Redis and emits event for platform rendering
   */
  async createInteraction(
    userId: string,
    threadId: string,
    channelId: string,
    teamId: string | undefined,
    data: {
      question: string;
      options: InteractionOptions;
      metadata?: any;
    }
  ): Promise<UserInteraction> {
    const interaction: UserInteraction = {
      id: `ui_${randomUUID()}`,
      userId,
      threadId,
      channelId,
      teamId,
      blocking: true,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + TIME.THREE_HOURS_MS,
      question: data.question,
      options: data.options,
      metadata: data.metadata,
    };

    // Store in Redis
    const key = `interaction:${interaction.id}`;
    await this.redis.set(
      key,
      JSON.stringify(interaction),
      "EX",
      TIME.THREE_HOURS_SECONDS
    );

    // Track pending interactions for this session
    const pendingKey = `interaction:pending:${threadId}`;
    await this.redis.sadd(pendingKey, interaction.id);
    await this.redis.expire(pendingKey, TIME.THREE_HOURS_SECONDS);

    // Mark thread as having an active interaction (blocks heartbeat deltas)
    const activeKey = `interaction:active:${threadId}`;
    await this.redis.set(
      activeKey,
      interaction.id,
      "EX",
      TIME.THREE_HOURS_SECONDS
    );

    logger.info(`Created interaction ${interaction.id} for thread ${threadId}`);

    // Emit event for platform to render
    this.emit("interaction:created", interaction);

    return interaction;
  }

  /**
   * Store the message timestamp for an interaction
   * Used to update the message later when user responds
   */
  async setMessageTs(interactionId: string, messageTs: string): Promise<void> {
    const key = `interaction:${interactionId}:messageTs`;
    await this.redis.set(key, messageTs, "EX", TIME.THREE_HOURS_SECONDS);
  }

  /**
   * Get the message timestamp for an interaction
   */
  async getMessageTs(interactionId: string): Promise<string | null> {
    const key = `interaction:${interactionId}:messageTs`;
    return await this.redis.get(key);
  }

  /**
   * Create non-blocking suggestions
   * Emits event immediately, no state tracking needed
   */
  async createSuggestion(
    userId: string,
    threadId: string,
    channelId: string,
    teamId: string | undefined,
    prompts: Array<{ title: string; message: string }>
  ): Promise<void> {
    const suggestion: UserSuggestion = {
      id: `sug_${randomUUID()}`,
      userId,
      threadId,
      channelId,
      teamId,
      blocking: false,
      prompts,
    };

    logger.info(`Created suggestion ${suggestion.id} for thread ${threadId}`);

    // Emit event for platform to render (no storage needed)
    this.emit("suggestion:created", suggestion);
  }

  /**
   * Respond to an interaction (called when user clicks button or submits form)
   * Emits event that will be sent to worker via SSE
   */
  async respond(
    id: string,
    response: {
      answer?: string; // For simple button responses
      formData?: Record<string, any>; // For form responses
    }
  ): Promise<void> {
    const key = `interaction:${id}`;
    const data = await this.redis.get(key);

    if (!data) {
      logger.warn(`Cannot respond to interaction ${id} - not found`);
      return;
    }

    const interaction: UserInteraction = JSON.parse(data);

    // Update interaction with response
    interaction.status = "responded";
    interaction.respondedAt = Date.now();
    interaction.response = {
      ...response,
      timestamp: Date.now(),
    };

    await this.redis.set(
      key,
      JSON.stringify(interaction),
      "EX",
      TIME.THREE_HOURS_SECONDS
    );

    // Remove from pending set
    const pendingKey = `interaction:pending:${interaction.threadId}`;
    await this.redis.srem(pendingKey, id);

    // Clear active interaction marker (allows heartbeat deltas again)
    const activeKey = `interaction:active:${interaction.threadId}`;
    await this.redis.del(activeKey);

    const responseStr = response.answer || JSON.stringify(response.formData);
    logger.info(`Interaction ${id} responded: ${responseStr}`);

    // Emit event
    this.emit("interaction:responded", interaction);
  }

  /**
   * Get pending interactions for a thread (for restart recovery)
   */
  async getPendingInteractions(threadId: string): Promise<string[]> {
    const pendingKey = `interaction:pending:${threadId}`;
    return await this.redis.smembers(pendingKey);
  }

  /**
   * Get interaction by ID
   */
  async getInteraction(interactionId: string): Promise<UserInteraction | null> {
    const key = `interaction:${interactionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as UserInteraction;
  }

  /**
   * Save partial form data for multi-form workflows
   * Used when user fills one form but hasn't submitted all
   */
  async savePartialData(
    interactionId: string,
    formLabel: string,
    formData: Record<string, any>
  ): Promise<void> {
    const key = `interaction:${interactionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      logger.warn(
        `Cannot save partial data for interaction ${interactionId} - not found`
      );
      return;
    }

    const interaction: UserInteraction = JSON.parse(data);

    // Initialize partialData if not exists
    if (!interaction.partialData) {
      interaction.partialData = {};
    }

    // Save this form's data
    interaction.partialData[formLabel] = formData;

    // Update in Redis
    await this.redis.set(
      key,
      JSON.stringify(interaction),
      "EX",
      TIME.THREE_HOURS_SECONDS
    );

    logger.info(
      `Saved partial data for form "${formLabel}" in interaction ${interactionId}`
    );
  }

  /**
   * Submit all collected form data (multi-form workflow)
   */
  async submitAllForms(interactionId: string): Promise<void> {
    const key = `interaction:${interactionId}`;
    const data = await this.redis.get(key);

    if (!data) {
      logger.warn(
        `Cannot submit forms for interaction ${interactionId} - not found`
      );
      return;
    }

    const interaction: UserInteraction = JSON.parse(data);

    if (
      !interaction.partialData ||
      Object.keys(interaction.partialData).length === 0
    ) {
      logger.warn(`No partial data to submit for interaction ${interactionId}`);
      return;
    }

    // Submit as final response with all form data
    await this.respond(interactionId, {
      formData: interaction.partialData,
    });
  }
}
