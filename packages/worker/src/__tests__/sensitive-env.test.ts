import { describe, expect, test } from "bun:test";
import { __testOnly, stripSensitiveWorkerEnv } from "../shared/sensitive-env";

describe("stripSensitiveWorkerEnv", () => {
  test("removes worker auth env vars and preserves other values", () => {
    const env = stripSensitiveWorkerEnv({
      PATH: "/usr/bin",
      WORKER_TOKEN: "secret",
      DISPATCHER_URL: "http://gateway:8080",
      HOME: "/workspace",
      EMPTY: undefined,
    });

    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/workspace",
    });
    expect(__testOnly.SENSITIVE_WORKER_ENV_KEYS).toEqual([
      "WORKER_TOKEN",
      "DISPATCHER_URL",
    ]);
  });
});
