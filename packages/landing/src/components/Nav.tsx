const GITHUB_URL = "https://github.com/lobu-ai/lobu";
const GITHUB_STARS_BADGE =
  "https://img.shields.io/github/stars/lobu-ai/lobu?style=social";

const leftLinks = [
  { label: "Skills", href: "/skills" },
  { label: "Pricing", href: "/serverless-openclaw" },
];

const rightLinks = [
  { label: "Docs", href: "/getting-started" },
  { label: "API", href: "/reference/api-reference" },
  { label: "Blog", href: "/blog" },
];

export function Nav() {
  return (
    <nav
      class="fixed top-0 left-0 right-0 z-50 px-8 py-3"
      style={{
        backgroundColor: "var(--color-page-bg-overlay)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-page-border)",
      }}
    >
      <div class="max-w-[60rem] mx-auto flex items-center">
        <a
          href="/"
          class="flex items-center gap-2 text-lg font-bold tracking-tight mr-8"
          style={{ color: "var(--color-page-text)" }}
        >
          <img src="/lobster-icon.png" alt="Lobu" class="w-7 h-7" />
          Lobu
        </a>
        <div class="flex items-center gap-6 mr-auto">
          {leftLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              class="text-sm transition-opacity hover:opacity-80"
              style={{ color: "var(--color-page-text-muted)" }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div class="flex items-center gap-6">
          {rightLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              class="text-sm transition-opacity hover:opacity-80"
              style={{ color: "var(--color-page-text-muted)" }}
            >
              {link.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <img src={GITHUB_STARS_BADGE} alt="GitHub stars" height="20" />
          </a>
        </div>
      </div>
    </nav>
  );
}
