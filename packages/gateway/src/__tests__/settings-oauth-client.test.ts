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

  test("dynamically registers a settings OAuth client when registration is available", async () => {
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
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.endsWith("/oauth/register")) {
          expect(init?.method).toBe("POST");
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
      redirectUri: "https://gateway.example.com/settings/oauth/callback",
      cacheStore: {
        get: async (key) => cache.get(key) ?? null,
        set: async (key, value) => {
          cache.set(key, value);
        },
      },
    });

    const authUrl = await client.buildAuthUrl("state-123", "verifier-123");
    const parsed = new URL(authUrl);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://issuer.example.com/oauth/authorize"
    );
    expect(parsed.searchParams.get("client_id")).toBe("dynamic-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://gateway.example.com/settings/oauth/callback"
    );
    expect(cache.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("reuses cached settings OAuth client credentials", async () => {
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
        "settings:oauth:client",
        JSON.stringify({
          client_id: "cached-client-id",
          token_endpoint_auth_method: "none",
        }),
      ],
    ]);

    const client = new SettingsOAuthClient({
      issuerUrl: "https://issuer.example.com",
      redirectUri: "https://gateway.example.com/settings/oauth/callback",
      cacheStore: {
        get: async (key) => cache.get(key) ?? null,
        set: async () => {
          throw new Error("should not write cache when already populated");
        },
      },
    });

    const authUrl = await client.buildAuthUrl("state-123", "verifier-123");
    expect(new URL(authUrl).searchParams.get("client_id")).toBe(
      "cached-client-id"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
