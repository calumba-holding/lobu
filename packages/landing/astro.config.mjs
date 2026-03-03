import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Force Zod v3 (bundled with Astro) over the workspace-hoisted Zod v4
const zodPath = `${dirname(require.resolve("astro/package.json"))}/node_modules/zod`;

const settingsDir = resolve(
  __dirname,
  "../gateway/src/routes/public/settings-page"
);
const mockApi = resolve(__dirname, "src/settings-mock/mock-api.ts");
const mockContext = resolve(__dirname, "src/settings-mock/mock-context.tsx");

function settingsMockPlugin() {
  return {
    name: "settings-mock",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer?.includes("settings-page")) return null;
      const resolved = resolve(dirname(importer), source);
      if (resolved === resolve(settingsDir, "api")) return mockApi;
      if (resolved === resolve(settingsDir, "app")) return mockContext;
      return null;
    },
  };
}

export default defineConfig({
  site: "https://lobu.ai",
  integrations: [
    starlight({
      title: "Lobu Docs",
      customCss: [
        "./src/styles/starlight-shared.css",
        "./src/styles/starlight-theme.css",
      ],
      components: {
        SiteTitle: "./src/components/starlight/SiteTitle.astro",
        Header: "./src/components/starlight/Header.astro",
        Footer: "./src/components/starlight/Footer.astro",
      },
      sidebar: [
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
        },
        { label: "Deployment", autogenerate: { directory: "deployment" } },
        {
          label: "Platforms",
          items: [
            { label: "Slack", link: "/platforms/slack/" },
            { label: "WhatsApp", link: "/platforms/whatsapp/" },
            { label: "Telegram", link: "/platforms/telegram/" },
            { label: "REST API", link: "/platforms/rest-api/" },
          ],
        },
        { label: "Guides", autogenerate: { directory: "guides" } },
        { label: "Reference", autogenerate: { directory: "reference" } },
        { label: "Comparison", autogenerate: { directory: "comparison" } },
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/lobu-ai/lobu",
        },
      ],
    }),
    preact({ compat: true }),
    sitemap(),
  ],
  vite: {
    plugins: [settingsMockPlugin(), tailwindcss()],
    resolve: {
      alias: {
        "@settings": settingsDir,
        zod: zodPath,
      },
    },
  },
});
