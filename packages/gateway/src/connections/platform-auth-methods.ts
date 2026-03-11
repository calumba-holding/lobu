export interface PlatformAuthMethod {
  type: "webapp-initdata" | "oauth" | "claim-code";
  scriptUrl?: string;
}

export const DEFAULT_AUTH_METHOD: PlatformAuthMethod = { type: "claim-code" };

const AUTH_METHODS: Record<string, PlatformAuthMethod> = {
  telegram: {
    type: "webapp-initdata",
    scriptUrl: "https://telegram.org/js/telegram-web-app.js",
  },
};

export function getAuthMethod(platform: string): PlatformAuthMethod {
  return AUTH_METHODS[platform] || DEFAULT_AUTH_METHOD;
}
