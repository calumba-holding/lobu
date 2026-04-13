#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const DEFAULT_CANDIDATES = [
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-coder:free",
];

function parseArgs(argv) {
  const args = { format: "env", write: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format" && argv[i + 1]) {
      args.format = argv[++i];
    } else if (arg === "--write" && argv[i + 1]) {
      args.write = argv[++i];
    }
  }
  return args;
}

function getCandidates() {
  const raw = process.env.OPENROUTER_FREE_MODELS?.trim();
  if (!raw) return DEFAULT_CANDIDATES;
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

function makeHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.OPENROUTER_HTTP_REFERER || "https://github.com/lobu-ai/lobu",
    "X-Title": process.env.OPENROUTER_APP_TITLE || "Lobu CI",
  };
}

async function listModels(apiKey) {
  const { response, data } = await fetchJson(
    "https://openrouter.ai/api/v1/models",
    {
      headers: makeHeaders(apiKey),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to list OpenRouter models (${response.status})`);
  }
  return new Map(
    (data.data || [])
      .filter((entry) => entry.id)
      .map((entry) => [entry.id, entry])
  );
}

async function probeModel(apiKey, model) {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: 'Call the ping tool with {"value":"OK"} and do nothing else.',
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "ping",
          description: "Return a value",
          parameters: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
            required: ["value"],
          },
        },
      },
    ],
    tool_choice: "auto",
    temperature: 0,
    max_tokens: 100,
  };

  const attempts = Number(process.env.OPENROUTER_PROBE_ATTEMPTS || 2);
  const retryDelayMs = Number(
    process.env.OPENROUTER_PROBE_RETRY_DELAY_MS || 1500
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const { response, data } = await fetchJson(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: makeHeaders(apiKey),
          body: JSON.stringify(body),
        }
      );
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
      const content = data?.choices?.[0]?.message?.content?.trim?.() || "";
      if (
        response.ok &&
        toolCall?.function?.name === "ping" &&
        /"value"\s*:\s*"OK"/i.test(toolCall?.function?.arguments || "")
      ) {
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          content,
        };
      }
      const message =
        data?.error?.message ||
        data?.raw ||
        `Unexpected probe response (${response.status})`;
      if (attempt === attempts) {
        return { ok: false, error: message, status: response.status };
      }
    } catch (error) {
      if (attempt === attempts) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  return { ok: false, error: "Probe failed" };
}

async function selectModel() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const candidates = getCandidates();
  if (candidates.length === 0) {
    throw new Error("No OpenRouter candidate models configured");
  }

  const availableModels = await listModels(apiKey);
  const diagnostics = [];

  for (const model of candidates) {
    const metadata = availableModels.get(model);
    if (!metadata) {
      diagnostics.push({ model, ok: false, error: "not_listed" });
      continue;
    }

    const supportedParameters = metadata.supported_parameters || [];
    if (
      !supportedParameters.includes("tools") ||
      !supportedParameters.includes("tool_choice")
    ) {
      diagnostics.push({ model, ok: false, error: "missing_tool_support" });
      continue;
    }

    const result = await probeModel(apiKey, model);
    diagnostics.push({ model, ...result });
    if (result.ok) {
      return { model, diagnostics };
    }
  }

  const summary = diagnostics
    .map((entry) => `${entry.model}: ${entry.error || "unknown_error"}`)
    .join("; ");
  throw new Error(`No healthy OpenRouter free model found. ${summary}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { model, diagnostics } = await selectModel();

  if (process.env.OPENROUTER_SELECTOR_VERBOSE === "1") {
    console.error(
      JSON.stringify({ selectedModel: model, diagnostics }, null, 2)
    );
  }

  const modelRef = `openrouter/${model}`;
  const output =
    args.format === "raw"
      ? model
      : `OPENROUTER_MODEL=${model}\nOPENROUTER_MODEL_REF=${modelRef}\nSELECTED_PROVIDER=openrouter\n`;

  if (args.write) {
    await writeFile(args.write, output);
  } else {
    process.stdout.write(output);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
