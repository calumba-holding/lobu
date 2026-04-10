const SENSITIVE_WORKER_ENV_KEYS = ["WORKER_TOKEN", "DISPATCHER_URL"] as const;

export function stripSensitiveWorkerEnv(
  env: Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }
    if (
      SENSITIVE_WORKER_ENV_KEYS.includes(
        key as (typeof SENSITIVE_WORKER_ENV_KEYS)[number]
      )
    ) {
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

export const __testOnly = {
  SENSITIVE_WORKER_ENV_KEYS,
};
