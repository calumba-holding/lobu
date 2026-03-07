import { WebClient } from "@slack/web-api";
import { Hono } from "hono";

type SlackInfo = {
  teamId: string;
  teamName: string;
  teamDomain?: string;
  botUserId: string;
  botName: string;
  dmLink: string;
};

type LandingOptions = {
  publicGatewayUrl?: string;
  githubUrl: string;
};

const SLACK_CACHE_TTL_MS = 5 * 60 * 1000;
let slackCache: {
  value: SlackInfo | null;
  expiresAt: number;
  inFlight?: Promise<SlackInfo | null>;
} | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSlackDmLink(teamId: string, botUserId: string): string {
  const params = new URLSearchParams({ team: teamId, channel: botUserId });
  return `https://slack.com/app_redirect?${params.toString()}`;
}

async function fetchSlackInfo(
  slackInstallationStore?: import("../../slack/installation-store").SlackInstallationStore
): Promise<SlackInfo | null> {
  const token = process.env.SLACK_BOT_TOKEN;

  // If no env token, try getting the first installation from the store
  // (The store is populated during OAuth or startup seeding)
  if (!token && slackInstallationStore) {
    // We don't have a "list all" method, so rely on env token for landing page
    // The landing page is informational - multi-workspace installs use their own tokens
  }

  if (!token) return null;

  const client = new WebClient(token);
  const auth = await client.auth.test();
  if (!auth.ok || !auth.team_id || !auth.user_id || !auth.user) {
    return null;
  }

  let teamName = auth.team ?? "Slack Workspace";
  let teamDomain: string | undefined;
  try {
    const team = await client.team.info();
    if (team.ok && team.team) {
      teamName = team.team.name || teamName;
      teamDomain = team.team.domain || undefined;
    }
  } catch {
    // Ignore team info failures; auth.test is enough to build DM link.
  }

  return {
    teamId: auth.team_id,
    teamName,
    teamDomain,
    botUserId: auth.user_id,
    botName: auth.user,
    dmLink: buildSlackDmLink(auth.team_id, auth.user_id),
  };
}

async function getSlackInfo(): Promise<SlackInfo | null> {
  const now = Date.now();
  if (slackCache && slackCache.expiresAt > now && slackCache.value) {
    return slackCache.value;
  }

  if (slackCache?.inFlight) {
    return slackCache.inFlight;
  }

  const inFlight = fetchSlackInfo()
    .then((value) => {
      slackCache = {
        value,
        expiresAt: Date.now() + SLACK_CACHE_TTL_MS,
      };
      return value;
    })
    .catch(() => {
      slackCache = { value: null, expiresAt: Date.now() + SLACK_CACHE_TTL_MS };
      return null;
    });

  slackCache = { value: null, expiresAt: now + SLACK_CACHE_TTL_MS, inFlight };
  return inFlight;
}

function renderLandingPage(options: {
  githubUrl: string;
  docsUrl: string;
  publicGatewayUrl?: string;
  slackInfo?: SlackInfo | null;
}): string {
  const githubUrl = escapeHtml(options.githubUrl);
  const docsUrl = escapeHtml(options.docsUrl);
  const publicGateway = options.publicGatewayUrl
    ? escapeHtml(options.publicGatewayUrl)
    : "";

  const slack = options.slackInfo;

  const slackStatus = slack
    ? `Workspace: ${escapeHtml(slack.teamName)}`
    : "Not configured";
  const slackLink = slack ? slack.dmLink : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lobu Gateway</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
      .gateway-box { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .gateway-box input { width: 70%; padding: 8px; font-size: 14px; }
      .gateway-box button { padding: 8px 16px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Lobu Gateway</h1>
    ${
      publicGateway
        ? `<div class="gateway-box">
      <label>Gateway URL: </label>
      <input type="text" value="${publicGateway}" readonly id="gatewayUrl" />
      <button onclick="copyUrl()">Copy</button>
    </div>`
        : ""
    }
    <ul>
      <li><a href="${docsUrl}">API Documentation</a></li>
      <li><a href="${githubUrl}" target="_blank" rel="noreferrer">GitHub</a></li>
      <li>Slack: ${slackStatus}${slack ? ` — <a href="${slackLink}" target="_blank" rel="noreferrer">Message ${escapeHtml(slack.botName)}</a>` : ""}</li>
    </ul>
    <script>
      function copyUrl() {
        const input = document.getElementById('gatewayUrl');
        input.select();
        document.execCommand('copy');
      }
    </script>
  </body>
</html>`;
}

export function createLandingRoutes(options: LandingOptions) {
  const app = new Hono();

  app.get("/", async (c) => {
    const slackInfo = await getSlackInfo();

    return c.html(
      renderLandingPage({
        githubUrl: options.githubUrl,
        docsUrl: "/api/docs",
        publicGatewayUrl: options.publicGatewayUrl,
        slackInfo,
      })
    );
  });

  return app;
}
