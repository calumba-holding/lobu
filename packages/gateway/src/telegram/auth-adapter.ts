/**
 * Telegram Auth Adapter - Platform-specific authentication handling.
 * Groups: claim-based OAuth flow (same as WhatsApp/Slack).
 * DMs: Telegram web_app button with initData auth.
 */

import { createLogger } from "@lobu/core";
import type { Bot } from "grammy";
import type { AuthProvider, PlatformAuthAdapter } from "../auth/platform-auth";
import {
  buildClaimSettingsUrl,
  type ClaimService,
} from "../auth/settings/claim-service";

const logger = createLogger("telegram-auth-adapter");

/**
 * Telegram-specific authentication adapter.
 * Sends a settings link where users can configure Claude auth, MCP, network, etc.
 */
export class TelegramAuthAdapter implements PlatformAuthAdapter {
  private claimService?: ClaimService;

  constructor(private bot: Bot) {}

  setClaimService(service: ClaimService): void {
    this.claimService = service;
  }

  async sendAuthPrompt(
    userId: string,
    channelId: string,
    _conversationId: string,
    _providers: AuthProvider[],
    platformMetadata?: Record<string, unknown>
  ): Promise<void> {
    const chatId = Number(
      (platformMetadata?.chatId as string | number) || channelId
    );
    const isGroup = chatId < 0;

    // Groups use claim-based OAuth flow (url button in group)
    if (isGroup) {
      if (!this.claimService) {
        logger.error("ClaimService not available for group auth prompt");
        throw new Error("ClaimService not configured");
      }

      const claimCode = await this.claimService.createClaim(
        "telegram",
        String(chatId),
        userId
      );
      const settingsUrl = buildClaimSettingsUrl(claimCode);

      const message = [
        "<b>Setup Required</b>",
        "",
        "You need to add a model provider to use this bot.",
        "Tap the button below to configure.",
      ].join("\n");

      try {
        await this.bot.api.sendMessage(chatId, message, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "Open Settings", url: settingsUrl }]],
          },
        });
        logger.info(
          { chatId, userId },
          "Sent claim-based settings link (group)"
        );
        return;
      } catch (error) {
        logger.error(
          { error, chatId },
          "Failed to send settings link in group"
        );
        throw error;
      }
    }

    // DMs: check if user has a linked OAuth identity
    if (!this.claimService) {
      logger.error("ClaimService not available for DM auth prompt");
      throw new Error("ClaimService not configured");
    }

    const baseUrl = process.env.PUBLIC_GATEWAY_URL || "http://localhost:8080";

    const linkedOAuthUserId = await this.claimService.getLinkedOAuthUserId(
      "telegram",
      userId
    );

    if (linkedOAuthUserId) {
      // Linked user: use web_app button with initData URL
      const settingsUrl = new URL("/settings", baseUrl);
      settingsUrl.searchParams.set("platform", "telegram");
      settingsUrl.searchParams.set("chat", String(chatId));

      const message = [
        "<b>Setup Required</b>",
        "",
        "You need to add a model provider to use this bot.",
        "Tap the button below to configure.",
      ].join("\n");

      try {
        await this.bot.api.sendMessage(chatId, message, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Open Settings",
                  web_app: { url: settingsUrl.toString() },
                },
              ],
            ],
          },
        });
        logger.info(
          { chatId, userId },
          "Sent web_app settings link (DM, linked)"
        );
        return;
      } catch (error) {
        logger.error({ error, chatId }, "Failed to send web_app settings link");
        throw error;
      }
    }

    // Not linked: url button with claim URL (opens in Telegram's browser for OAuth)
    const dmClaimCode = await this.claimService.createClaim(
      "telegram",
      String(chatId),
      userId
    );
    const settingsUrl = buildClaimSettingsUrl(dmClaimCode);

    const message = [
      "<b>Setup Required</b>",
      "",
      "You need to add a model provider to use this bot.",
      "Tap the button below to sign in and configure.",
    ].join("\n");

    try {
      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Sign In", url: settingsUrl }]],
        },
      });
      logger.info(
        { chatId, userId },
        "Sent url button settings link (DM, not linked)"
      );
    } catch (error) {
      logger.error({ error, chatId }, "Failed to send settings link");
      throw error;
    }
  }

  async sendAuthSuccess(
    userId: string,
    channelId: string,
    provider: AuthProvider
  ): Promise<void> {
    const chatId = Number(channelId);

    const message = [
      `<b>Authentication Successful!</b>`,
      "",
      `You're now connected to ${provider.name}.`,
      "",
      "Send your message again to continue.",
    ].join("\n");

    try {
      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: "HTML",
      });
      logger.info(
        { channelId, userId, provider: provider.id },
        "Sent auth success message"
      );
    } catch (error) {
      logger.error({ error, channelId }, "Failed to send auth success message");
    }
  }

  async handleAuthResponse(
    _channelId: string,
    _userId: string,
    _text: string
  ): Promise<boolean> {
    return false;
  }

  hasPendingAuth(_channelId: string): boolean {
    return false;
  }
}
