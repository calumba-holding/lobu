function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolvePublicBaseUrl(options?: {
  configuredUrl?: string;
  requestUrl?: string;
  fallbackUrl?: string;
}): string {
  const configuredUrl =
    options?.configuredUrl || process.env.PUBLIC_GATEWAY_URL;
  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (options?.requestUrl) {
    return normalizeBaseUrl(new URL(options.requestUrl).origin);
  }

  return normalizeBaseUrl(options?.fallbackUrl || "http://localhost:8080");
}

export function resolvePublicUrl(
  path: string,
  options?: {
    configuredUrl?: string;
    requestUrl?: string;
    fallbackUrl?: string;
  }
): string {
  return new URL(path, `${resolvePublicBaseUrl(options)}/`).toString();
}
