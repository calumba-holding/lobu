import { createHash, randomBytes } from "node:crypto";
import { BaseOAuth2Client } from "./base-client";
import type { ClaudeCredentials } from "../claude/credential-store";

/**
 * Claude-specific OAuth client with PKCE support
 * Uses public client ID (no client secret needed)
 *
 * Extends base OAuth2 client and adds PKCE-specific logic
 */
export class ClaudeOAuthClient extends BaseOAuth2Client {
  private static readonly CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
  private static readonly AUTH_URL = "https://claude.ai/oauth/authorize";
  private static readonly TOKEN_URL =
    "https://console.anthropic.com/v1/oauth/token";
  private static readonly REDIRECT_URI_BASE =
    "https://console.anthropic.com/oauth/code/callback";

  constructor() {
    super("claude-oauth-client");
  }

  /**
   * Generate PKCE code verifier (43-128 characters, base64url encoded)
   */
  generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  /**
   * Generate PKCE code challenge from verifier using SHA256
   */
  generateCodeChallenge(codeVerifier: string): string {
    return createHash("sha256").update(codeVerifier).digest("base64url");
  }

  /**
   * Build authorization URL with PKCE parameters
   */
  buildAuthUrl(
    state: string,
    codeVerifier: string,
    customRedirectUri?: string
  ): string {
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const redirectUri =
      customRedirectUri || ClaudeOAuthClient.REDIRECT_URI_BASE;

    const url = new URL(ClaudeOAuthClient.AUTH_URL);
    url.searchParams.set("client_id", ClaudeOAuthClient.CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "user:inference");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return url.toString();
  }

  /**
   * Exchange authorization code for access token using PKCE
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    customRedirectUri?: string
  ): Promise<ClaudeCredentials> {
    const redirectUri =
      customRedirectUri || ClaudeOAuthClient.REDIRECT_URI_BASE;

    const body = {
      grant_type: "authorization_code",
      code,
      client_id: ClaudeOAuthClient.CLIENT_ID,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    };

    const tokenData = await this.exchangeToken<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    }>(ClaudeOAuthClient.TOKEN_URL, body, "json");

    const expiresAt = this.calculateExpiresAt(tokenData.expires_in)!;
    const scopes = this.parseScopes(tokenData.scope);

    this.logger.info(
      `Token exchange successful, expires_in: ${tokenData.expires_in}s`,
      { scopes }
    );

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || "Bearer",
      expiresAt,
      scopes,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<ClaudeCredentials> {
    const body = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ClaudeOAuthClient.CLIENT_ID,
    };

    const tokenData = await this.refreshAccessToken<{
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      scope: string;
    }>(ClaudeOAuthClient.TOKEN_URL, body, "json");

    const expiresAt = this.calculateExpiresAt(tokenData.expires_in)!;
    const scopes = this.parseScopes(tokenData.scope);

    this.logger.info(
      `Token refresh successful, expires_in: ${tokenData.expires_in}s`
    );

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Keep old if not provided
      tokenType: tokenData.token_type || "Bearer",
      expiresAt,
      scopes,
    };
  }
}
