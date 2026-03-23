import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { SettingsOAuthClient } from "../auth/settings/oauth-client";

describe("SettingsOAuthClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("dynamically registers a client and requests device grant support when available", async () => {
    const fetchMock = mock(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/.well-known/openid-configuration")) {
          return new Response(
            JSON.stringify({
              issuer: "https://issuer.example.com",
              authorization_endpoint:
                "https://issuer.example.com/oauth/authorize",
              token_endpoint: "https://issuer.example.com/oauth/token",
              registration_endpoint:
                "https://issuer.example.com/oauth/register",
              userinfo_endpoint: "https://issuer.example.com/oauth/userinfo",
              device_authorization_endpoint:
                "https://issuer.example.com/oauth/device_authorization",
              grant_types_supported: [
                "authorization_code",
                "refresh_token",
                "urn:ietf:params:oauth:grant-type:device_code",
              ],
              token_endpoint_auth_methods_supported: ["none"],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.endsWith("/oauth/register")) {
          expect(init?.method).toBe("POST");
          const body = JSON.parse(String(init?.body)) as {
            grant_types?: string[];
            token_endpoint_auth_method?: string;
          };
          expect(body.grant_types).toContain(
            "urn:ietf:params:oauth:grant-type:device_code"
          );
          expect(body.token_endpoint_auth_method).toBe("none");

          return new Response(
            JSON.stringify({
              client_id: "dynamic-client-id",
              token_endpoint_auth_method: "none",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }
    );

    globalThis.fetch = fetchMock as typeof fetch;

    const cache = new Map<string, string>();
    const client = new SettingsOAuthClient({
      issuerUrl: "https://issuer.example.com",
      redirectUri: "https://gateway.example.com/agent/oauth/callback",
      cacheStore: {
        get: async (key) => cache.get(key) ?? null,
        set: async (key, value) => {
          cache.set(key, value);
        },
      },
    });

    const capabilities = await client.getCapabilities();
    expect(capabilities).toEqual({ browser: true, device: true });

    const authUrl = await client.buildAuthUrl("state-123", "verifier-123");
    const parsed = new URL(authUrl);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://issuer.example.com/oauth/authorize"
    );
    expect(parsed.searchParams.get("client_id")).toBe("dynamic-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://gateway.example.com/agent/oauth/callback"
    );
    expect(cache.size).toBe(1);
    // Discovery is cached in-memory after first call, so only 2 fetches: discovery + registration
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("reuses cached client credentials and falls back to browser-only when device flow is unavailable", async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(
          JSON.stringify({
            issuer: "https://issuer.example.com",
            authorization_endpoint:
              "https://issuer.example.com/oauth/authorize",
            token_endpoint: "https://issuer.example.com/oauth/token",
            registration_endpoint: "https://issuer.example.com/oauth/register",
            userinfo_endpoint: "https://issuer.example.com/oauth/userinfo",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const cache = new Map<string, string>([
      [
        "external:auth:client:v3",
        JSON.stringify({
          client_id: "cached-client-id",
          token_endpoint_auth_method: "none",
        }),
      ],
    ]);

    const client = new SettingsOAuthClient({
      issuerUrl: "https://issuer.example.com",
      redirectUri: "https://gateway.example.com/agent/oauth/callback",
      cacheStore: {
        get: async (key) => cache.get(key) ?? null,
        set: async () => {
          throw new Error("should not write cache when already populated");
        },
      },
    });

    const capabilities = await client.getCapabilities();
    expect(capabilities).toEqual({ browser: true, device: false });

    const authUrl = await client.buildAuthUrl("state-123", "verifier-123");
    expect(new URL(authUrl).searchParams.get("client_id")).toBe(
      "cached-client-id"
    );
    // Discovery is cached in-memory after getCapabilities(), so buildAuthUrl() reuses it
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("treats authorization_pending and slow_down as pending during device polling", async () => {
    let tokenPolls = 0;
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(
          JSON.stringify({
            authorization_endpoint:
              "https://issuer.example.com/oauth/authorize",
            token_endpoint: "https://issuer.example.com/oauth/token",
            device_authorization_endpoint:
              "https://issuer.example.com/oauth/device_authorization",
            userinfo_endpoint: "https://issuer.example.com/oauth/userinfo",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/oauth/token")) {
        tokenPolls += 1;
        return new Response(
          JSON.stringify({
            error: tokenPolls === 1 ? "authorization_pending" : "slow_down",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const client = new SettingsOAuthClient({
      issuerUrl: "https://issuer.example.com",
      clientId: "static-client-id",
      redirectUri: "https://gateway.example.com/agent/oauth/callback",
    });

    const pending = await client.pollDeviceAuthorization("device-1", 5);
    expect(pending).toEqual({ status: "pending", interval: 5 });

    const slowed = await client.pollDeviceAuthorization("device-1", 5);
    expect(slowed).toEqual({ status: "pending", interval: 10 });
  });

  test("returns device auth errors and fetches userinfo after successful device login", async () => {
    let tokenPolls = 0;
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(
          JSON.stringify({
            authorization_endpoint:
              "https://issuer.example.com/oauth/authorize",
            token_endpoint: "https://issuer.example.com/oauth/token",
            device_authorization_endpoint:
              "https://issuer.example.com/oauth/device_authorization",
            userinfo_endpoint: "https://issuer.example.com/oauth/userinfo",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/oauth/token")) {
        tokenPolls += 1;
        if (tokenPolls === 1) {
          return new Response(
            JSON.stringify({
              error: "expired_token",
              error_description: "This device code expired.",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            access_token: "provider-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            refresh_token: "provider-refresh-token",
            scope: "profile:read",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/oauth/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "user-123",
            email: "user@example.com",
            name: "Example User",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const client = new SettingsOAuthClient({
      issuerUrl: "https://issuer.example.com",
      clientId: "static-client-id",
      redirectUri: "https://gateway.example.com/agent/oauth/callback",
    });

    const expired = await client.pollDeviceAuthorization("device-1", 5);
    expect(expired).toEqual({
      status: "error",
      error: "This device code expired.",
      errorCode: "expired_token",
    });

    const complete = await client.pollDeviceAuthorization("device-1", 5);
    expect(complete.status).toBe("complete");
    if (complete.status !== "complete") {
      throw new Error("Expected complete device auth result");
    }
    expect(complete.credentials.accessToken).toBe("provider-access-token");
    expect(complete.user).toEqual({
      sub: "user-123",
      email: "user@example.com",
      name: "Example User",
    });
  });
});
