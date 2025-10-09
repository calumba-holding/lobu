#!/usr/bin/env bun

import type { IMessageQueue } from "@peerbot/core";
import { createLogger, verifyWorkerToken } from "@peerbot/core";
import type { Request, Response } from "express";
import { WorkerConnectionManager } from "./connection-manager";
import { WorkerJobRouter } from "./job-router";

const logger = createLogger("worker-gateway");

/**
 * Worker Gateway - SSE and HTTP endpoints for worker communication
 * Workers connect via SSE to receive jobs, send responses via HTTP POST
 * Uses encrypted tokens for authentication and routing
 */
export class WorkerGateway {
  private connectionManager: WorkerConnectionManager;
  private jobRouter: WorkerJobRouter;
  private queue: IMessageQueue;

  constructor(queue: IMessageQueue) {
    this.queue = queue;
    this.connectionManager = new WorkerConnectionManager();
    this.jobRouter = new WorkerJobRouter(queue, this.connectionManager);
  }

  /**
   * Setup routes on Express app
   */
  setupRoutes(app: any) {
    // SSE endpoint for workers to receive jobs
    app.get("/worker/stream", (req: Request, res: Response) =>
      this.handleStreamConnection(req, res)
    );

    // HTTP POST endpoint for workers to send responses
    app.post("/worker/response", (req: Request, res: Response) =>
      this.handleWorkerResponse(req, res)
    );

    logger.info("Worker gateway routes registered");
  }

  /**
   * Handle SSE connection from worker
   */
  private async handleStreamConnection(req: Request, res: Response) {
    const authHeader = req.headers.authorization;

    // Verify worker token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    const tokenData = verifyWorkerToken(token);

    if (!tokenData) {
      logger.warn("Invalid token");
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { deploymentName, userId, threadId } = tokenData;

    // Setup SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Register connection with connection manager
    this.connectionManager.addConnection(deploymentName, userId, threadId, res);

    // Register job router for this worker (if not already registered)
    const isRegistered =
      await this.jobRouter.isWorkerRegistered(deploymentName);
    if (!isRegistered) {
      await this.jobRouter.registerWorker(deploymentName);
    }

    // Handle client disconnect
    req.on("close", () => {
      this.connectionManager.removeConnection(deploymentName);
      // Note: We don't unregister the job router - worker might reconnect
    });
  }

  /**
   * Handle HTTP response from worker
   */
  private async handleWorkerResponse(req: Request, res: Response) {
    const authHeader = req.headers.authorization;

    // Verify worker token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    const tokenData = verifyWorkerToken(token);

    if (!tokenData) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { deploymentName } = tokenData;

    // Update connection activity
    this.connectionManager.touchConnection(deploymentName);

    try {
      const { jobId, ...responseData } = req.body;

      // Acknowledge job completion if jobId provided
      if (jobId) {
        this.jobRouter.acknowledgeJob(jobId);
      }

      // Send response to thread_response queue
      await this.queue.send("thread_response", responseData);

      res.json({ success: true });
    } catch (error) {
      logger.error(`Error handling worker response: ${error}`);
      res.status(500).json({ error: "Failed to process response" });
    }
  }

  /**
   * Get active worker connections
   */
  getActiveConnections(): string[] {
    return this.connectionManager.getActiveConnections();
  }

  /**
   * Shutdown gateway
   */
  shutdown(): void {
    this.connectionManager.shutdown();
    this.jobRouter.shutdown();
  }
}
