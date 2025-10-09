export * from "./impl";
export { MessageConsumer as QueueConsumer } from "./message-consumer";
export * from "./types";

import { moduleRegistry } from "@peerbot/core";
import {
  type BaseDeploymentManager,
  createLogger,
  type OrchestratorConfig,
} from "@peerbot/core";
import { buildModuleEnvVars } from "./deployment-utils";
import { DockerDeploymentManager, K8sDeploymentManager } from "./impl";
import { MessageConsumer } from "./message-consumer";

const logger = createLogger("orchestrator");

export class Orchestrator {
  private config: OrchestratorConfig;
  private deploymentManager: BaseDeploymentManager;
  private queueConsumer: MessageConsumer;
  private isRunning = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.deploymentManager = this.createDeploymentManager(config);
    this.queueConsumer = new MessageConsumer(config, this.deploymentManager);
  }

  private createDeploymentManager(
    config: OrchestratorConfig
  ): BaseDeploymentManager {
    const deploymentMode = process.env.DEPLOYMENT_MODE;

    if (deploymentMode === "docker") {
      if (!this.isDockerAvailable()) {
        logger.error("DEPLOYMENT_MODE=docker but Docker is not available");
        throw new Error("DEPLOYMENT_MODE=docker but Docker is not available");
      }
      return new DockerDeploymentManager(config, buildModuleEnvVars);
    }

    if (deploymentMode === "kubernetes" || deploymentMode === "k8s") {
      if (!this.isKubernetesAvailable()) {
        logger.error(
          "DEPLOYMENT_MODE=kubernetes but Kubernetes is not available"
        );
        throw new Error(
          "DEPLOYMENT_MODE=kubernetes but Kubernetes is not available"
        );
      }
      return new K8sDeploymentManager(config, buildModuleEnvVars);
    }

    // Auto-detect deployment mode
    if (this.isKubernetesAvailable()) {
      return new K8sDeploymentManager(config, buildModuleEnvVars);
    }

    if (this.isDockerAvailable()) {
      return new DockerDeploymentManager(config, buildModuleEnvVars);
    }

    logger.error("Neither Kubernetes nor Docker is available");
    throw new Error("Neither Kubernetes nor Docker is available");
  }

  private isKubernetesAvailable(): boolean {
    try {
      if (process.env.KUBERNETES_SERVICE_HOST) {
        return true;
      }

      const fs = require("node:fs");
      const os = require("node:os");
      const path = require("node:path");

      const kubeconfigPaths = [
        process.env.KUBECONFIG,
        path.join(os.homedir(), ".kube", "config"),
      ].filter(Boolean);

      return kubeconfigPaths.some((configPath) => {
        try {
          return fs.existsSync(configPath) && fs.statSync(configPath).isFile();
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  private isDockerAvailable(): boolean {
    try {
      const { execSync } = require("node:child_process");
      execSync("docker version", { stdio: "ignore", timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    try {
      // Initialize modules
      await moduleRegistry.initAll();
      logger.info("✅ Modules initialized for orchestration");

      // Start queue consumer
      await this.queueConsumer.start();

      // Setup periodic cleanup
      this.setupIdleCleanup();

      this.isRunning = true;
      logger.info("✅ Orchestrator started successfully");
    } catch (error) {
      logger.error("❌ Failed to start orchestrator:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      await this.queueConsumer.stop();
      logger.info("✅ Orchestrator stopped");
    } catch (error) {
      logger.error("❌ Error stopping orchestrator:", error);
    }
  }

  private setupIdleCleanup(): void {
    setTimeout(() => {
      this.deploymentManager.reconcileDeployments().catch((error) => {
        logger.error("❌ Initial deployment reconciliation failed:", error);
      });
    }, this.config.cleanup.initialDelayMs);

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.deploymentManager.reconcileDeployments();
      } catch (error) {
        logger.error(
          "Error during deployment reconciliation:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }, this.config.cleanup.intervalMs);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: {
        kubernetes: {
          namespace: this.config.kubernetes.namespace,
        },
        queues: {
          retryLimit: this.config.queues.retryLimit,
          expireInSeconds: this.config.queues.expireInSeconds,
        },
      },
    };
  }

  async getQueueStats() {
    return this.queueConsumer.getQueueStats();
  }
}

export type {
  BaseDeploymentManager,
  DeploymentInfo,
  generateDeploymentName,
  ModuleEnvVarsBuilder,
  OrchestratorConfig,
  QueueJobData,
} from "@peerbot/core";
