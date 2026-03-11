import { randomBytes } from "node:crypto";
import { createLogger } from "@lobu/core";
import { OAuthClient } from "../oauth/client";
import type { OAuthProviderConfig } from "../oauth/providers";

const logger = createLogger("settings-oauth-client");
const SETTINGS_OAUTH_CACHE_KEY = "settings:oauth:client";

export interface SettingsOAuthConfig {
  issuerUrl: string;
  clientId?: string;
  clientSecret?: string;
  /** Override authorize URL (skips .well-known discovery) */
  authorizeUrl?: string;
  /** Override token URL (skips .well-known discovery) */
  tokenUrl?: string;
  /** Override userinfo URL (skips .well-known discovery) */
  userinfoUrl?: string;
  /** Redirect URI for settings OAuth callback */
  redirectUri: string;
  cacheStore?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
  };
}

interface WellKnownMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  userinfo_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
}

interface UserInfoResponse {
  sub: string;
  email: string;
  name?: string;
}

interface DynamicClientCredentials {
  client_id: string;
  client_secret?: string;
  token_endpoint_auth_method?:
    | "none"
    | "client_secret_post"
    | "client_secret_basic";
  client_secret_expires_at?: number;
}

/**
 * OAuth client for settings page authentication.
 * Wraps the generic OAuthClient with .well-known discovery and userinfo support.
 */
export class SettingsOAuthClient {
  private oauthClient: OAuthClient | null = null;
  private userinfoUrl: string | null = null;
  private config: SettingsOAuthConfig;
  private discoveryDone = false;

  constructor(config: SettingsOAuthConfig) {
    this.config = config;
  }

  /**
   * Ensure discovery is done and OAuthClient is ready.
   */
  private async ensureInitialized(): Promise<OAuthClient> {
    if (this.oauthClient && this.discoveryDone) return this.oauthClient;

    const metadata = await this.discoverMetadata();
    let authUrl = this.config.authorizeUrl;
    let tokenUrl = this.config.tokenUrl;
    this.userinfoUrl = this.config.userinfoUrl || null;

    if (!authUrl && metadata) {
      authUrl = metadata.authorization_endpoint;
    }
    if (!tokenUrl && metadata) {
      tokenUrl = metadata.token_endpoint;
    }
    if (!this.userinfoUrl && metadata?.userinfo_endpoint) {
      this.userinfoUrl = metadata.userinfo_endpoint;
    }

    if (!authUrl || !tokenUrl) {
      throw new Error(
        "Settings OAuth: authorization and token URLs are required (set SETTINGS_OAUTH_AUTHORIZE_URL/TOKEN_URL or ensure .well-known/openid-configuration is accessible)"
      );
    }

    const dynamicCredentials = this.config.clientSecret
      ? null
      : await this.getDynamicClientCredentials(metadata);
    const clientId = dynamicCredentials?.client_id || this.config.clientId;
    const clientSecret =
      dynamicCredentials?.client_secret || this.config.clientSecret;

    if (!clientId) {
      throw new Error(
        "Settings OAuth: client registration failed and no static client ID is configured"
      );
    }

    const tokenEndpointAuthMethod =
      dynamicCredentials?.token_endpoint_auth_method ||
      (clientSecret ? "client_secret_post" : "none");

    const providerConfig: OAuthProviderConfig = {
      id: "settings-oauth",
      name: "Settings OAuth",
      clientId,
      clientSecret,
      authUrl,
      tokenUrl,
      redirectUri: this.config.redirectUri,
      scope: "profile:read",
      usePKCE: true,
      responseType: "code",
      grantType: "authorization_code",
      tokenEndpointAuthMethod,
      requireRefreshToken: false,
    };

    this.oauthClient = new OAuthClient(providerConfig);
    this.discoveryDone = true;
    return this.oauthClient;
  }

  /**
   * Generate a PKCE code verifier
   */
  generateCodeVerifier(): string {
    if (this.oauthClient) return this.oauthClient.generateCodeVerifier();
    return randomBytes(32).toString("base64url");
  }

  /**
   * Build the authorization URL
   */
  async buildAuthUrl(state: string, codeVerifier: string): Promise<string> {
    const client = await this.ensureInitialized();
    return client.buildAuthUrl(state, codeVerifier);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string, codeVerifier: string) {
    const client = await this.ensureInitialized();
    return client.exchangeCodeForToken(code, codeVerifier);
  }

  /**
   * Fetch user info from the OAuth provider's userinfo endpoint
   */
  async fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
    await this.ensureInitialized();

    if (!this.userinfoUrl) {
      throw new Error(
        "Settings OAuth: userinfo_endpoint not available (set SETTINGS_OAUTH_USERINFO_URL or ensure provider exposes it in .well-known)"
      );
    }

    const response = await fetch(this.userinfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch user info: ${response.status} ${errorText}`
      );
    }

    const data = (await response.json()) as UserInfoResponse;
    logger.info("Fetched user info", { sub: data.sub, email: data.email });
    return data;
  }

  private async discoverMetadata(): Promise<WellKnownMetadata | null> {
    try {
      const wellKnownUrl = `${this.config.issuerUrl}/.well-known/openid-configuration`;
      logger.info(`Discovering OAuth endpoints from ${wellKnownUrl}`);
      const response = await fetch(wellKnownUrl);
      if (response.ok) {
        const metadata = (await response.json()) as WellKnownMetadata;
        logger.info("Discovered OAuth endpoints", {
          authUrl: this.config.authorizeUrl || metadata.authorization_endpoint,
          tokenUrl: this.config.tokenUrl || metadata.token_endpoint,
          userinfoUrl:
            this.config.userinfoUrl || metadata.userinfo_endpoint || null,
          registrationEndpoint: metadata.registration_endpoint || null,
        });
        return metadata;
      }
      logger.warn(
        `Failed to fetch .well-known: ${response.status}, using manual config`
      );
    } catch (error) {
      logger.warn("Failed to discover OAuth endpoints", { error });
    }
    return null;
  }

  private async getDynamicClientCredentials(
    metadata: WellKnownMetadata | null
  ): Promise<DynamicClientCredentials | null> {
    if (!metadata?.registration_endpoint) {
      return null;
    }

    const cached = await this.getCachedClientCredentials();
    if (cached) {
      return cached;
    }

    try {
      logger.info("Registering settings OAuth client dynamically", {
        registrationEndpoint: metadata.registration_endpoint,
      });

      const response = await fetch(metadata.registration_endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Lobu Settings",
          redirect_uris: [this.config.redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn("Settings OAuth client registration failed", {
          status: response.status,
          errorText,
        });
        return null;
      }

      const credentials = (await response.json()) as DynamicClientCredentials;
      await this.cacheClientCredentials(credentials);
      logger.info("Settings OAuth client registered", {
        clientId: credentials.client_id,
        tokenEndpointAuthMethod:
          credentials.token_endpoint_auth_method || "none",
      });
      return credentials;
    } catch (error) {
      logger.warn("Settings OAuth client registration failed", { error });
      return null;
    }
  }

  private async getCachedClientCredentials(): Promise<DynamicClientCredentials | null> {
    if (!this.config.cacheStore) {
      return null;
    }

    try {
      const raw = await this.config.cacheStore.get(SETTINGS_OAUTH_CACHE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as DynamicClientCredentials;
    } catch (error) {
      logger.warn("Failed to load cached settings OAuth client", { error });
      return null;
    }
  }

  private async cacheClientCredentials(
    credentials: DynamicClientCredentials
  ): Promise<void> {
    if (!this.config.cacheStore) {
      return;
    }

    const ttlSeconds =
      credentials.client_secret_expires_at &&
      credentials.client_secret_expires_at > 0
        ? Math.max(
            60,
            Math.floor(credentials.client_secret_expires_at - Date.now() / 1000)
          )
        : 7 * 24 * 60 * 60;

    try {
      await this.config.cacheStore.set(
        SETTINGS_OAUTH_CACHE_KEY,
        JSON.stringify(credentials),
        ttlSeconds
      );
    } catch (error) {
      logger.warn("Failed to cache settings OAuth client", { error });
    }
  }

  /**
   * Check if settings OAuth is configured via environment variables
   */
  static isConfigured(): boolean {
    return !!(
      process.env.SETTINGS_OAUTH_ISSUER_URL ||
      (process.env.SETTINGS_OAUTH_AUTHORIZE_URL &&
        process.env.SETTINGS_OAUTH_TOKEN_URL)
    );
  }

  /**
   * Create from environment variables
   */
  static fromEnv(
    publicGatewayUrl: string,
    cacheStore?: SettingsOAuthConfig["cacheStore"]
  ): SettingsOAuthClient | null {
    const issuerUrl = process.env.SETTINGS_OAUTH_ISSUER_URL;
    const clientId = process.env.SETTINGS_OAUTH_CLIENT_ID;

    if (
      !issuerUrl &&
      (!process.env.SETTINGS_OAUTH_AUTHORIZE_URL ||
        !process.env.SETTINGS_OAUTH_TOKEN_URL)
    ) {
      return null;
    }

    return new SettingsOAuthClient({
      issuerUrl: issuerUrl || publicGatewayUrl,
      clientId,
      clientSecret: process.env.SETTINGS_OAUTH_CLIENT_SECRET,
      authorizeUrl: process.env.SETTINGS_OAUTH_AUTHORIZE_URL,
      tokenUrl: process.env.SETTINGS_OAUTH_TOKEN_URL,
      userinfoUrl: process.env.SETTINGS_OAUTH_USERINFO_URL,
      redirectUri: `${publicGatewayUrl}/settings/oauth/callback`,
      cacheStore,
    });
  }
}
