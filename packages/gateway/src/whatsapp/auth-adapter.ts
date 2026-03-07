/**
 * WhatsApp Auth Adapter - Platform-specific authentication handling.
 * Sends claim-based settings link for authentication and configuration.
 */

import { createLogger } from "@lobu/core";
import type { AuthProvider, PlatformAuthAdapter } from "../auth/platform-auth";
import {
  buildClaimSettingsUrl,
  type ClaimService,
} from "../auth/settings/claim-service";
import type { BaileysClient } from "./connection/baileys-client";

const logger = createLogger("whatsapp-auth-adapter");

/**
 * WhatsApp-specific authentication adapter.
 * Sends a settings link where users can configure Claude auth, MCP, network, etc.
 */
export class WhatsAppAuthAdapter implements PlatformAuthAdapter {
  private claimService?: ClaimService;

  constructor(
    private client: BaileysClient,
    _publicGatewayUrl: string
  ) {}

  setClaimService(service: ClaimService): void {
    this.claimService = service;
  }

  /**
   * Send authentication required prompt with settings link.
   * The settings page handles Claude OAuth, MCP config, network access, etc.
   */
  async sendAuthPrompt(
    userId: string,
    channelId: string,
    _conversationId: string,
    _providers: AuthProvider[],
    platformMetadata?: Record<string, unknown>
  ): Promise<void> {
    const chatJid = (platformMetadata?.jid as string) || channelId;
    const agentId = (platformMetadata?.agentId as string) || channelId;

    if (!this.claimService) {
      logger.error("ClaimService not available for auth prompt");
      throw new Error("ClaimService not configured");
    }

    const claimCode = await this.claimService.createClaim(
      "whatsapp",
      chatJid,
      userId
    );
    const settingsUrl = buildClaimSettingsUrl(claimCode, { agentId });

    const message = [
      "*Setup Required*",
      "",
      "You need to add a model provider to use this bot.",
      "Configure it using this link:",
      "",
      settingsUrl,
    ].join("\n");

    try {
      await this.client.sendMessage(chatJid, { text: message });
      logger.info({ chatJid, userId, agentId }, "Sent settings link");
    } catch (error) {
      logger.error({ error, chatJid }, "Failed to send settings link");
      throw error;
    }
  }

  /**
   * Send authentication success message.
   */
  async sendAuthSuccess(
    userId: string,
    channelId: string,
    provider: AuthProvider
  ): Promise<void> {
    const message = [
      `*Authentication Successful!*`,
      "",
      `You're now connected to ${provider.name}.`,
      "",
      "Send your message again to continue.",
    ].join("\n");

    try {
      await this.client.sendMessage(channelId, { text: message });
      logger.info(
        { channelId, userId, provider: provider.id },
        "Sent auth success message"
      );
    } catch (error) {
      logger.error({ error, channelId }, "Failed to send auth success message");
    }
  }

  /**
   * No longer handling auth responses - settings page handles everything.
   */
  async handleAuthResponse(
    _channelId: string,
    _userId: string,
    _text: string
  ): Promise<boolean> {
    return false;
  }

  /**
   * No pending auth sessions anymore.
   */
  hasPendingAuth(_channelId: string): boolean {
    return false;
  }
}
