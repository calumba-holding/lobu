const SCHEDULE_CALL_URL = "https://calendar.app.google/LwAk3ecptkJQaYr87";

const TelegramIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const SlackIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

const ApiIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 17l6-6-6-6M12 19h8" />
  </svg>
);

const tryLinks = [
  { label: "Telegram", href: "https://t.me/lobuaibot", Icon: TelegramIcon },
  {
    label: "Install to Slack Workspace",
    href: "https://community.lobu.ai/slack/install",
    Icon: SlackIcon,
  },
  {
    label: "Join Slack Community",
    href: "https://join.slack.com/t/peerbot/shared_invite/zt-391o8tyw2-iyupjTG1xHIz9Og8C7JOnw",
    Icon: SlackIcon,
  },
  {
    label: "REST API",
    href: "https://community.lobu.ai/api/docs",
    Icon: ApiIcon,
  },
];

export function HeroSection() {
  return (
    <section class="pt-28 pb-12 px-8 relative">
      <style>{`
        .hero-audience-rotator {
          display: inline-flex;
          height: 1.1em;
          overflow: hidden;
          vertical-align: bottom;
          text-align: left;
        }

        .hero-audience-track {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          animation: rotate-hero-audience 9s ease-in-out infinite;
        }

        .hero-audience-item {
          line-height: 1.1;
        }

        @keyframes rotate-hero-audience {
          0%,
          23% {
            transform: translateY(0);
          }
          33%,
          56% {
            transform: translateY(-1.1em);
          }
          66%,
          89% {
            transform: translateY(-2.2em);
          }
          100% {
            transform: translateY(-3.3em);
          }
        }
      `}</style>
      <div class="max-w-2xl mx-auto text-center relative">
        <h1
          class="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-5 whitespace-nowrap"
          style={{ color: "var(--color-page-text)" }}
        >
          <span
            style={{
              color: "var(--color-tg-accent)",
            }}
          >
            OpenClaw
          </span>{" "}
          for your{" "}
          <span class="hero-audience-rotator" aria-live="off">
            <span class="hero-audience-track">
              <span class="hero-audience-item">team</span>
              <span class="hero-audience-item">customers</span>
              <span class="hero-audience-item">family</span>
              <span class="hero-audience-item" aria-hidden="true">
                team
              </span>
            </span>
          </span>
        </h1>
        <p
          class="text-lg max-w-xl mx-auto mb-8 leading-relaxed"
          style={{ color: "var(--color-page-text-muted)" }}
        >
          Ship your OpenClaw product faster with sandboxed, per-customer agents
          provisioned on demand.
        </p>

        {/* CTA buttons */}
        <div class="flex flex-wrap gap-3 mb-8 justify-center">
          <a
            href={SCHEDULE_CALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all hover:opacity-90"
            style={{
              backgroundColor: "var(--color-page-text)",
              color: "var(--color-page-bg)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Talk to Founder
          </a>
          <a
            href="#installation"
            class="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-all hover:opacity-90"
            style={{
              color: "var(--color-page-text-muted)",
              border: "1px solid var(--color-page-border)",
            }}
          >
            Install
          </a>
        </div>

        {/* Try it links */}
        <div
          class="flex flex-wrap items-center gap-3 text-[11px] justify-center"
          style={{ color: "var(--color-page-text-muted)" }}
        >
          <span>Try it</span>
          {tryLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--color-page-surface-dim)",
                border: "1px solid var(--color-page-border)",
                color: "var(--color-page-text-muted)",
              }}
            >
              <link.Icon />
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
