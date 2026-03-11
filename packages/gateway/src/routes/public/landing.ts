import { Hono } from "hono";

type LandingOptions = {
  publicGatewayUrl?: string;
  githubUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLandingPage(options: {
  githubUrl: string;
  docsUrl: string;
  publicGatewayUrl?: string;
}): string {
  const githubUrl = escapeHtml(options.githubUrl);
  const docsUrl = escapeHtml(options.docsUrl);
  const publicGateway = options.publicGatewayUrl
    ? escapeHtml(options.publicGatewayUrl)
    : "";

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
    return c.html(
      renderLandingPage({
        githubUrl: options.githubUrl,
        docsUrl: "/api/docs",
        publicGatewayUrl: options.publicGatewayUrl,
      })
    );
  });

  return app;
}
