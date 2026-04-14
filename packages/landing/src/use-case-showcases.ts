import {
  landingUseCases,
  technicalLinks,
  type HowItWorksPanel,
  type LandingUseCaseDefinition,
  type LandingUseCaseId,
  type MemoryExample,
  type SkillWorkspacePreviewData,
} from "./use-case-definitions";

type RuntimeStep = {
  title: string;
  detail: string;
  chips?: string[];
};

type RuntimeJourney = {
  requestLabel: string;
  request: string;
  summary: string;
  steps: RuntimeStep[];
  outcomeLabel: string;
  outcome: string[];
};

type RuntimeJourneyInput = Omit<
  RuntimeJourney,
  "requestLabel" | "outcomeLabel"
>;

type CampaignMeta = {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  ctaHref: string;
  ctaLabel: string;
};

export type ShowcaseSkillWorkspacePreview = SkillWorkspacePreviewData & {
  useCaseId: LandingUseCaseId;
  examplePath: string;
};

export type ShowcaseMemoryExample = MemoryExample & {
  useCaseId: LandingUseCaseId;
  examplePath: string;
};

export type LandingUseCaseShowcase = {
  id: LandingUseCaseId;
  label: string;
  examplePath: string;
  campaign: CampaignMeta;
  runtime: RuntimeJourney;
  skills: ShowcaseSkillWorkspacePreview;
  memory: ShowcaseMemoryExample;
};

const docsLinks = {
  owlettoDocs: { label: "What is Owletto?", href: "/getting-started/memory/" },
  ...technicalLinks,
};

const memoryStepPanels: Record<
  LandingUseCaseId,
  Partial<Record<"connect" | "auth" | "reuse", HowItWorksPanel>>
> = {
  "market-intelligence": {
    connect: {
      title: "Market intel source inputs",
      description:
        "Brand and product memory comes from monitoring the channels where competitive signals appear.",
      items: [
        {
          meta: "Product Hunt",
          label: "Launch tracking",
          detail:
            "Monitor product launches, feature announcements, and upvotes for competitive positioning signals.",
        },
        {
          meta: "Crunchbase",
          label: "Funding database",
          detail:
            "Pull funding rounds, investor syndicates, and valuation changes for company growth tracking.",
        },
        {
          meta: "Review sites",
          label: "Customer feedback",
          detail:
            "Aggregate reviews and comparisons to understand how products are positioned against alternatives.",
        },
        {
          meta: "News & social",
          label: "Market chatter",
          detail:
            "Track mentions, feature announcements, and strategic moves across news and social channels.",
        },
      ],
    },
    auth: {
      title: "How market data is connected",
      description:
        "Connect product and brand data sources while keeping API keys outside the agent runtime.",
      items: [
        {
          meta: "API key",
          label: "Premium databases",
          detail:
            "Store Crunchbase, PitchBook, or other research platform keys centrally for company and funding data.",
        },
        {
          meta: "RSS feeds",
          label: "News and reviews",
          detail:
            "Pull industry news, blog coverage, and review updates through RSS without per-request auth.",
        },
        {
          meta: "Web scraping",
          label: "Public websites",
          detail:
            "Monitor company blogs, changelogs, and pricing pages for product and positioning updates.",
        },
        {
          meta: "Agent boundary",
          label: "Scoped access",
          detail:
            "The market agent receives extracted insights, not raw credentials or database dumps.",
        },
      ],
    },
    reuse: {
      title: "Market intelligence agents",
      description:
        "The same brand and product memory powers competitive analysis wherever teams work.",
      items: [
        {
          label: "Competitive analysis",
          detail: "Drafts comparison briefs with latest features and pricing.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Deal screen assistant",
          detail:
            "Checks company signals and market position before investment.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
        {
          label: "Product strategist",
          detail: "Reuses positioning insights across go-to-market planning.",
          platform: { id: "claude", label: "Claude" },
        },
      ],
    },
  },
  "agent-community": {
    connect: {
      title: "Community source inputs",
      description:
        "Member context comes from the places people already publish work, identity, and intent.",
      items: [
        {
          meta: "GitHub",
          label: "Code and repo activity",
          detail:
            "Track maintained repositories, contribution patterns, and technical areas of focus from connected GitHub accounts.",
        },
        {
          meta: "LinkedIn",
          label: "Role and company context",
          detail:
            "Pull current title, company, and professional background to keep the member graph aligned with real-world changes.",
        },
        {
          meta: "Newsletter / blog",
          label: "Public writing and interests",
          detail:
            "Use Substack, RSS, and personal blogs to capture what members are actively thinking and writing about.",
        },
        {
          meta: "Profile import",
          label: "Member-provided context",
          detail:
            "Collect explicit goals, interests, and who the member wants to meet through forms or manual imports.",
        },
      ],
    },
    auth: {
      title: "How members connect accounts",
      description:
        "Members connect accounts through MCP auth flows and operators can supplement that with public feeds or imports.",
      items: [
        {
          meta: "MCP login",
          label: "Connected accounts",
          detail:
            "Use MCP/OAuth login for sources like GitHub and LinkedIn without exposing raw credentials to agents.",
        },
        {
          meta: "Public feeds",
          label: "Websites and newsletters",
          detail:
            "Pull RSS, Substack, and public website content directly when a source does not require a private login.",
        },
        {
          meta: "Manual import",
          label: "Profile setup",
          detail:
            "Let members or operators fill in a profile form or upload a structured import for goals, tags, and intro preferences.",
        },
        {
          meta: "Agent boundary",
          label: "Scoped access",
          detail:
            "The community agent works with structured member context and approved workflows, not raw account credentials.",
        },
      ],
    },
    reuse: {
      title: "Community agents and workflows",
      description:
        "The same member graph can power discovery, concierge, and intro workflows wherever the community already operates.",
      items: [
        {
          label: "Community concierge",
          detail: "Answers questions like who should meet this week and why.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Member search agent",
          detail:
            "Finds members by topic, project, or recent activity using the shared graph.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
        {
          label: "Intro drafting workflow",
          detail:
            "Prepares warm intro drafts for Slack or email and waits for approval before sending.",
          platform: { id: "claude", label: "Claude" },
        },
      ],
    },
  },
  ecommerce: {
    connect: {
      title: "Ecommerce source inputs",
      description:
        "Customer and subscription memory comes from the platforms where purchase and support activity happens.",
      items: [
        {
          meta: "Shopify",
          label: "Store and order data",
          detail:
            "Pull customer profiles, order history, and product catalog from the Shopify Admin API.",
        },
        {
          meta: "Subscriptions",
          label: "Recurring billing",
          detail:
            "Sync subscription plans, billing cycles, skips, and cancellations from Recharge or native Shopify subscriptions.",
        },
        {
          meta: "Helpdesk",
          label: "Support interactions",
          detail:
            "Capture customer requests, resolutions, and follow-ups from support channels.",
        },
        {
          meta: "Email & chat",
          label: "Customer communications",
          detail:
            "Track delivery preferences, complaints, and feedback from direct customer messages.",
        },
      ],
    },
    auth: {
      title: "How store data is connected",
      description:
        "Connect ecommerce platforms while keeping API credentials outside the agent runtime.",
      items: [
        {
          meta: "OAuth",
          label: "Shopify and subscriptions",
          detail:
            "Authorize Shopify Admin API and subscription platform access once for customer and order data.",
        },
        {
          meta: "API key",
          label: "Helpdesk and tools",
          detail:
            "Store scoped credentials centrally for support ticketing and communication tools.",
        },
        {
          meta: "Webhooks",
          label: "Real-time events",
          detail:
            "Receive order, subscription, and fulfillment updates as they happen without polling.",
        },
        {
          meta: "Agent boundary",
          label: "Scoped access",
          detail:
            "The ecommerce agent receives customer context, not raw store credentials or payment data.",
        },
      ],
    },
    reuse: {
      title: "Ecommerce agents",
      description:
        "The same customer and subscription memory powers ecommerce agents wherever teams work.",
      items: [
        {
          label: "Subscription manager",
          detail:
            "Handles plan changes, skips, and upgrades with customer context and approval flows.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Order support agent",
          detail:
            "Resolves order inquiries, tracks deliveries, and processes returns.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
        {
          label: "Customer insights assistant",
          detail:
            "Summarizes customer history, preferences, and lifetime value for support and sales.",
          platform: { id: "claude", label: "Claude" },
        },
      ],
    },
  },
  careops: {
    connect: {
      title: "Care operations source inputs",
      description:
        "Patient care memory is built from the systems clinical and operational teams already use.",
      items: [
        {
          meta: "EHR",
          label: "Patient records",
          detail:
            "Pull treatment history, diagnoses, and care plans from the electronic health record system.",
        },
        {
          meta: "Calendar",
          label: "Appointments",
          detail:
            "Sync scheduled sessions, cancellations, and availability from therapist calendars.",
        },
        {
          meta: "Email",
          label: "Patient communications",
          detail:
            "Capture handoff notes, treatment updates, and follow-up commitments from email threads.",
        },
        {
          meta: "Patient portal",
          label: "Self-reported data",
          detail:
            "Import patient-reported outcomes, symptom trackers, and feedback through the patient portal.",
        },
      ],
    },
    auth: {
      title: "How patient data is connected",
      description:
        "Connect clinical systems while maintaining HIPAA compliance and credential isolation.",
      items: [
        {
          meta: "OAuth",
          label: "EHR and calendar",
          detail:
            "Authorize read-only access to patient schedules and treatment history for care coordination.",
        },
        {
          meta: "Service account",
          label: "Internal practice tools",
          detail:
            "Use practice management credentials for scheduling and insurance verification.",
        },
        {
          meta: "Secure import",
          label: "Patient records",
          detail:
            "Load HIPAA-compliant imports for new patients or transferring from other providers.",
        },
        {
          meta: "Isolation",
          label: "Agent boundary",
          detail:
            "The care agent receives context, not raw patient data or PHI directly.",
        },
      ],
    },
    reuse: {
      title: "Care coordination agents",
      description:
        "The same patient care memory powers clinical workflows wherever the team works.",
      items: [
        {
          label: "Care coordinator",
          detail:
            "Checks appointment availability and treatment progress before scheduling.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Handoff assistant",
          detail:
            "Summarizes care status and treatment progress when handing off between therapists.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Therapist assistant",
          detail:
            "Drafts session notes and treatment plan updates based on patient conversations.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  "venture-capital": {
    connect: {
      title: "Venture capital source inputs",
      description:
        "Company and deal memory comes from public databases, proprietary sources, and internal deal memos.",
      items: [
        {
          meta: "Data providers",
          label: "Company databases",
          detail:
            "Pull funding rounds, company descriptions, and team data from Crunchbase, PitchBook, or similar platforms.",
        },
        {
          meta: "Web scraping",
          label: "Company websites",
          detail:
            "Monitor company blogs, engineering blogs, and job postings for growth and product signals.",
        },
        {
          meta: "News API",
          label: "Press and announcements",
          detail:
            "Track funding announcements, leadership changes, and strategic moves from news and press releases.",
        },
        {
          meta: "Internal",
          label: "Deal memos and notes",
          detail:
            "Import investment committee memos, sourcing notes, and partnership discussions for private context.",
        },
      ],
    },
    auth: {
      title: "How deal data is connected",
      description:
        "Connect data providers and internal tools while keeping credentials isolated from workers.",
      items: [
        {
          meta: "API key",
          label: "Premium databases",
          detail:
            "Store Crunchbase API keys or PitchBook credentials centrally for company and funding data.",
        },
        {
          meta: "RSS",
          label: "Company news feeds",
          detail:
            "Pull company blog RSS feeds, tech press, and announcement lists without per-request auth.",
        },
        {
          meta: "Web auth",
          label: "Private portals",
          detail:
            "Authorize access to investor portals or private company databases for portfolio monitoring.",
        },
        {
          meta: "Agent boundary",
          label: "Credential isolation",
          detail:
            "The VC agent receives extracted company insights, not raw database access.",
        },
      ],
    },
    reuse: {
      title: "Venture capital agents",
      description:
        "The same company and deal memory powers investment workflows across the firm.",
      items: [
        {
          label: "Deal screener",
          detail:
            "Checks company signals, funding history, and team background before first calls.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Portfolio monitor",
          detail:
            "Tracks portfolio company growth, competitive moves, and follow-on opportunities.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
        {
          label: "IC assistant",
          detail:
            "Prep investment committee memos with company context and market analysis.",
          platform: { id: "claude", label: "Claude" },
        },
      ],
    },
  },
  legal: {
    connect: {
      title: "Legal source inputs",
      description:
        "The contract graph is built from the systems and artifacts legal teams already use.",
      items: [
        {
          meta: "Upload",
          label: "Draft agreement",
          detail:
            "Capture the latest NDA, redlines, or negotiated fallback language directly from a file upload.",
        },
        {
          meta: "Sync",
          label: "Shared legal drive",
          detail:
            "Pull prior templates, playbooks, and approved fallback clauses from the team document workspace.",
        },
        {
          meta: "MCP",
          label: "Research tools",
          detail:
            "Bring in legal research or internal clause libraries through MCP-backed integrations.",
        },
        {
          meta: "Pipeline",
          label: "Clause extraction",
          detail:
            "Feed parser output into structured entities so venue, residuals, and term risk stay queryable.",
        },
      ],
    },
    auth: {
      title: "How access is handled",
      description:
        "Operators connect the data source once, and workers only receive the approved memory/tool surface.",
      items: [
        {
          meta: "OAuth",
          label: "Drive and document systems",
          detail:
            "Counsel can connect shared docs without exposing tokens to the review agent.",
        },
        {
          meta: "Credential",
          label: "Research providers",
          detail:
            "API-backed legal tools stay behind the gateway proxy with centrally managed secrets.",
        },
        {
          meta: "Manual",
          label: "Negotiated drafts",
          detail:
            "One-off uploads work even when a contract never lives in a connected SaaS app.",
        },
        {
          meta: "Isolation",
          label: "Runtime boundary",
          detail:
            "The worker sees extracted context and proxy URLs, not raw account credentials.",
        },
      ],
    },
    reuse: {
      title: "Legal agents",
      description:
        "The same contract memory powers legal agents wherever teams work.",
      items: [
        {
          label: "Risk review agent",
          detail:
            "Flags unresolved clauses and approval blockers in active negotiations.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Negotiation assistant",
          detail:
            "Recalls fallback language and prior concessions before the next draft.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Counterparty brief agent",
          detail:
            "Summarizes prior asks, objections, and open terms for the same external party.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Draft prep workflow",
          detail:
            "Carries approved edits and unresolved risks into the next review cycle.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  devops: {
    connect: {
      title: "Operational events",
      description:
        "Turn live operational signals into structured incident memory.",
      table: {
        columns: ["Entity", "Events", "Sources", "Added context"],
        rows: [
          [
            "Alerts",
            "Triggered, resolved, severity changed",
            "PagerDuty, Datadog",
            "State, urgency, impact",
          ],
          [
            "Code",
            "PRs, fixes, rollbacks",
            "GitHub, GitLab",
            "Change timeline",
          ],
          [
            "Deploys",
            "Started, failed, rolled back",
            "CI/CD, Argo, Kubernetes",
            "Rollout history",
          ],
          [
            "Notes",
            "Updates, handoffs, comments",
            "Slack, incident tools",
            "Decisions and context",
          ],
        ],
      },
    },
    auth: {
      title: "Connected accounts",
      description:
        "Let teams bring the tools they already use, while keeping credentials outside the worker.",
      table: {
        columns: ["Account", "Brought by", "Access", "Used for"],
        rows: [
          ["GitHub / GitLab", "User", "OAuth", "PRs, commits, diffs"],
          [
            "Slack / Linear / Notion",
            "User",
            "OAuth",
            "Notes, tickets, team context",
          ],
          [
            "PagerDuty / Datadog",
            "User or admin",
            "OAuth / token",
            "Alerts and incident state",
          ],
          [
            "AWS / GCP / Kubernetes",
            "Org admin",
            "Service account",
            "Infra and deploy metadata",
          ],
          ["Incident history", "Org", "Import / sync", "Memory bootstrap"],
        ],
      },
    },
    reuse: {
      title: "DevOps agents",
      description:
        "The same incident memory powers operational agents wherever teams work.",
      items: [
        {
          label: "Incident responder",
          detail: "Answers what broke, what changed, and what’s blocked now.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Deploy safety agent",
          detail: "Checks rollback readiness and deploy risk before action.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
        {
          label: "Status update agent",
          detail:
            "Drafts current impact and remediation updates from live state.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Postmortem assistant",
          detail:
            "Reuses the same timeline for follow-up analysis and action items.",
          platform: { id: "claude", label: "Claude" },
        },
      ],
    },
  },
  support: {
    connect: {
      title: "Support source inputs",
      description:
        "Relationship memory comes from the same channels support teams already work in every day.",
      items: [
        {
          meta: "Inbox",
          label: "Message threads",
          detail:
            "Capture promises, preference changes, and ownership notes directly from conversations.",
        },
        {
          meta: "CRM",
          label: "Account sync",
          detail:
            "Pull company context, owners, and lifecycle state from the customer system of record.",
        },
        {
          meta: "Email",
          label: "Follow-up history",
          detail:
            "Attach promised summaries, deadlines, and replies to the right person record.",
        },
        {
          meta: "Knowledge",
          label: "Internal tools",
          detail:
            "Bring in structured account data or operational notes through MCP and custom integrations.",
        },
      ],
    },
    auth: {
      title: "How customer data is connected",
      description:
        "Support teams can authorize inboxes, CRMs, and imports without handing secrets to the runtime.",
      items: [
        {
          meta: "OAuth",
          label: "Inbox and calendar context",
          detail:
            "Connect communication tools so preferences and follow-ups stay in sync.",
        },
        {
          meta: "API key",
          label: "Internal support systems",
          detail:
            "Store scoped credentials centrally for ticketing or account lookup tools.",
        },
        {
          meta: "Import",
          label: "Historical contacts",
          detail:
            "Load CSV or manual records to seed memory before the next live conversation.",
        },
        {
          meta: "Isolation",
          label: "Agent boundary",
          detail:
            "The support agent receives context, not the raw credentials behind it.",
        },
      ],
    },
    reuse: {
      title: "Support agents",
      description:
        "The same relationship memory powers support agents wherever teams work.",
      items: [
        {
          label: "Support responder",
          detail:
            "Drafts replies that match customer preferences and the latest promises.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Handoff assistant",
          detail:
            "Keeps owners, commitments, and next steps intact when a case moves teams.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Account context agent",
          detail:
            "Recalls who the contact is, what they own, and what was promised last.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Follow-up workflow",
          detail:
            "Turns prior asks into durable next actions that future workflows can pick up.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  finance: {
    connect: {
      title: "Finance source inputs",
      description:
        "Variance memory stays credible because it is tied back to ledgers, payment systems, and close artifacts.",
      items: [
        {
          meta: "ERP",
          label: "General ledger data",
          detail:
            "Pull account state and period close context from the finance system of record.",
        },
        {
          meta: "Payments",
          label: "Stripe payouts and refunds",
          detail:
            "Bring payout timing and refund behavior into the same variance graph.",
        },
        {
          meta: "Import",
          label: "CSV reconciliations",
          detail:
            "Load one-off analyses and exceptions without losing the source artifact behind them.",
        },
        {
          meta: "Workflow",
          label: "Close checklist",
          detail:
            "Connect reporting milestones and unresolved items to the same operational record.",
        },
      ],
    },
    auth: {
      title: "How finance data is connected",
      description:
        "Sensitive financial access stays scoped and auditable while agents still get the context they need.",
      items: [
        {
          meta: "API key",
          label: "Finance SaaS tools",
          detail:
            "Use centrally managed credentials for accounting and payment providers.",
        },
        {
          meta: "Service account",
          label: "Internal pipelines",
          detail:
            "Attach warehouse or reconciliation jobs without exposing long-lived secrets.",
        },
        {
          meta: "Manual",
          label: "Exception imports",
          detail:
            "Allow operators to load one-off close evidence when automation is not the right path.",
        },
        {
          meta: "Isolation",
          label: "Worker boundary",
          detail:
            "The agent reasons over reconciled state, not raw credentials or unrestricted system access.",
        },
      ],
    },
    reuse: {
      title: "Finance agents",
      description:
        "The same variance memory powers finance agents wherever teams work.",
      items: [
        {
          label: "Variance analyst",
          detail:
            "Explains why an account moved and what still needs reconciliation before close.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Reporting assistant",
          detail:
            "Carries reconciliation context into month-end updates and leadership reporting.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Exception triage agent",
          detail:
            "Surfaces which refunds, payouts, or adjustments still need owner follow-up.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Audit prep workflow",
          detail:
            "Keeps explanations attached to the originating systems and imported evidence.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  sales: {
    connect: {
      title: "Revenue source inputs",
      description:
        "Account memory is strongest when commercial, product, and support signals land in one graph.",
      items: [
        {
          meta: "CRM",
          label: "Account updates",
          detail:
            "Track account ownership, renewal timing, and opportunity movement from the CRM.",
        },
        {
          meta: "Product",
          label: "Usage and rollout signals",
          detail:
            "Bring expansion health and adoption trends into the renewal story.",
        },
        {
          meta: "Support",
          label: "Risk signals",
          detail:
            "Attach escalations and service friction to the same account record.",
        },
        {
          meta: "Notes",
          label: "Internal call notes",
          detail:
            "Preserve pricing concerns, champion feedback, and next steps from humans in the loop.",
        },
      ],
    },
    auth: {
      title: "How revenue systems are connected",
      description:
        "Sales and ops tools can be authorized safely while memory stays reusable across agents.",
      items: [
        {
          meta: "OAuth",
          label: "CRM and GTM SaaS",
          detail:
            "Connect account systems without injecting raw tokens into the worker.",
        },
        {
          meta: "API key",
          label: "Product and support data",
          detail:
            "Store provider credentials centrally for telemetry or health signals.",
        },
        {
          meta: "Service account",
          label: "Internal pipelines",
          detail:
            "Sync warehouse or scoring outputs into the account graph on a schedule.",
        },
        {
          meta: "Import",
          label: "Historical account state",
          detail:
            "Seed memory from spreadsheets or exports before automations are wired up.",
        },
      ],
    },
    reuse: {
      title: "Revenue agents",
      description:
        "The same account memory powers revenue agents wherever teams work.",
      items: [
        {
          label: "Renewal prep agent",
          detail:
            "Pulls current risks, owners, and blockers before a customer call or QBR.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Forecast brief assistant",
          detail:
            "Generates consistent leadership updates from the same account memory.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Expansion context agent",
          detail:
            "Recalls which team owns the rollout, where adoption is growing, and what is blocking expansion.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Next-step workflow",
          detail:
            "Hands the right commercial follow-up to chat agents and planning tools.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  delivery: {
    connect: {
      title: "Project source inputs",
      description:
        "Project memory comes from issue trackers, docs, chat, and app events — not from one fragile weekly summary.",
      items: [
        {
          meta: "Tracker",
          label: "GitHub and Linear",
          detail:
            "Pull blockers, milestones, and implementation status from delivery systems.",
        },
        {
          meta: "Chat",
          label: "Slack updates",
          detail:
            "Capture informal status changes and dependency mentions from the team thread.",
        },
        {
          meta: "Docs",
          label: "Launch and planning docs",
          detail:
            "Attach review notes and project artifacts to the same graph as the rollout itself.",
        },
        {
          meta: "Events",
          label: "Internal app signals",
          detail:
            "Ingest app-specific rollout or milestone updates through MCP and SDK integrations.",
        },
      ],
    },
    auth: {
      title: "How project systems are connected",
      description:
        "Delivery tools can stay integrated without turning the worker into a secret holder.",
      items: [
        {
          meta: "OAuth",
          label: "Engineering tools",
          detail:
            "Authorize GitHub, Linear, and docs once, then route requests through the proxy layer.",
        },
        {
          meta: "API key",
          label: "Internal services",
          detail:
            "Use scoped credentials for app-specific rollout metadata and delivery dashboards.",
        },
        {
          meta: "Webhook",
          label: "Historical or event imports",
          detail:
            "Feed older project state and new events into memory without manual copy-paste.",
        },
        {
          meta: "Isolation",
          label: "Agent boundary",
          detail:
            "The planner sees shared context, while auth stays outside the runtime.",
        },
      ],
    },
    reuse: {
      title: "Delivery agents",
      description:
        "The same project memory powers delivery agents wherever teams work.",
      items: [
        {
          label: "Standup agent",
          detail:
            "Answers what is blocked, who owns it, and which milestone is at risk.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Planning assistant",
          detail:
            "Brings prior docs, owners, and dependencies into the next planning session.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Launch readiness agent",
          detail:
            "Uses one shared memory graph for rollout status, docs, and unresolved risks.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Stakeholder update workflow",
          detail:
            "Generates Monday risk updates from the same project record leadership already trusts.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
  leadership: {
    connect: {
      title: "Decision source inputs",
      description:
        "Executive memory should stay tied to source documents and follow-up evidence, not a lossy summary.",
      items: [
        {
          meta: "Upload",
          label: "Board memo and packet files",
          detail:
            "Treat the original document as evidence while extracting decisions and assignments from it.",
        },
        {
          meta: "Drive",
          label: "Cloud document systems",
          detail:
            "Sync docs and presentations from connected workspaces without copying them by hand.",
        },
        {
          meta: "Browser",
          label: "Authenticated knowledge systems",
          detail:
            "Use browser-backed access for tools that do not expose a clean API surface.",
        },
        {
          meta: "SDK",
          label: "Custom internal feeds",
          detail:
            "Attach finance, legal, or operating context through MCP and Connector SDK integrations.",
        },
      ],
    },
    auth: {
      title: "How document access is handled",
      description:
        "Leaders and operators can connect the right document systems while keeping auth outside the worker.",
      items: [
        {
          meta: "OAuth",
          label: "Drive and docs",
          detail:
            "Authorize cloud document providers once for recurring imports and lookups.",
        },
        {
          meta: "Browser auth",
          label: "Knowledge tools",
          detail:
            "Use browser-based sessions when source systems require interactive login.",
        },
        {
          meta: "API key",
          label: "Attached data services",
          detail:
            "Combine document context with internal APIs or external knowledge tools behind the proxy.",
        },
        {
          meta: "Manual",
          label: "Direct uploads",
          detail:
            "Allow operators to capture important memos immediately, even before connectors are set up.",
        },
      ],
    },
    reuse: {
      title: "Leadership agents",
      description:
        "The same decision memory powers leadership agents wherever teams work.",
      items: [
        {
          label: "Decision recall agent",
          detail:
            "Answers what was approved, what is blocked, and which region or budget line it affects.",
          platform: { id: "claude", label: "Claude" },
        },
        {
          label: "Assignment tracker",
          detail:
            "Keeps action items visible across future workflows and follow-ups.",
          platform: { id: "slack", label: "Slack" },
        },
        {
          label: "Document QA assistant",
          detail:
            "Answers from the extracted graph without re-reading every memo in full.",
          platform: { id: "chatgpt", label: "ChatGPT" },
        },
        {
          label: "Board prep workflow",
          detail:
            "Carries pending decisions and blockers into the next briefing cycle.",
          platform: { id: "openclaw", label: "OpenClaw" },
        },
      ],
    },
  },
};

const runtimeContent: Record<LandingUseCaseId, RuntimeJourneyInput> = {
  legal: {
    request:
      "Review Redwood's NDA, flag risk, and tell me what still needs counsel approval.",
    summary:
      "Run a legal review agent in chat, bundle the tools it needs, and keep contract context in shared memory for the next draft.",
    steps: [
      {
        title: "Runtime handles the live task",
        detail:
          "Lobu receives the request in chat, opens the right skill bundle, and runs the review inside a sandboxed worker.",
      },
      {
        title: "Skills bring the right tools",
        detail:
          "The legal skill bundles research access, contract workflows, network policy, and instructions into one installable unit.",
      },
      {
        title: "Memory keeps legal context durable",
        detail:
          "Owletto stores the contract, clause, risk, and counterparty graph so future reviews begin with the same evidence.",
      },
    ],
    outcome: [
      "Clause-level risk summary with citations",
      "Recommended edits and unresolved approval items",
      "Durable contract context for future negotiation turns",
    ],
  },
  devops: {
    request: "What's blocking today's deploy, and can we roll back safely?",
    summary:
      "Combine live operational checks with persistent incident memory so on-call engineers get a useful answer fast.",
    steps: [
      {
        title: "Runtime gathers the live state",
        detail:
          "Lobu checks incidents, PRs, and deploy tools in a sandbox and asks for approval before any risky action.",
        chips: ["PagerDuty", "GitHub", "k8s", "approvals"],
      },
      {
        title: "Skills package the ops workflow",
        detail:
          "The DevOps skill bundles MCP servers, allowed domains, and instructions for triage, rollback, and handoff.",
        chips: ["MCP", "network allowlist", "tool policy"],
      },
      {
        title: "Memory tracks the incident graph",
        detail:
          "Owletto links the current outage to affected services, triggering deploys, and remediation work so context survives handoffs.",
        chips: ["incident memory", "service graph"],
      },
    ],
    outcome: [
      "A current deploy-risk answer with blockers called out",
      "Incident and rollback context shared across the team",
      "Fewer repeated explanations during on-call handoffs",
    ],
  },
  support: {
    request:
      "Draft a response for Alex Kim, note the owner, and remind me about the Thursday follow-up.",
    summary:
      "Use one support workflow to pull account context, draft the next response, and keep relationship memory updated for the next conversation.",
    steps: [
      {
        title: "Runtime responds in the channel the team already uses",
        detail:
          "Lobu receives the support request in chat, runs the agent safely, and can trigger approvals or routing when needed.",
        chips: ["Slack", "WhatsApp", "REST API"],
      },
      {
        title: "Skills connect the operational systems",
        detail:
          "The support bundle can talk to ticketing, knowledge, and escalation tools without leaking credentials to workers.",
        chips: ["Zendesk", "knowledge base", "auth proxy"],
      },
      {
        title: "Memory remembers the relationship",
        detail:
          "Owletto stores the contact, organization, communication preferences, and promised follow-up so the next reply starts from context.",
        chips: ["contact memory", "follow-ups", "preferences"],
      },
    ],
    outcome: [
      "Faster first replies with consistent context",
      "Less re-triage across shifts and escalations",
      "Shared memory for owners, preferences, and next steps",
    ],
  },
  finance: {
    request:
      "Explain the Stripe variance on Account 4100 and prep the month-end note.",
    summary:
      "Let a finance operator agent pull live sources, explain the variance, and store structured reconciliation context for the close.",
    steps: [
      {
        title: "Runtime reads live finance systems safely",
        detail:
          "Lobu runs the reconciliation flow in a sandbox and uses configured tools to inspect payment and accounting sources.",
        chips: ["sandbox", "close workflow", "tool access"],
      },
      {
        title: "Skills bundle accounting integrations",
        detail:
          "The finance skill package carries the MCP servers, domains, and instructions needed for reconciliations and reporting.",
        chips: ["QuickBooks", "Stripe", "CSV tools"],
      },
      {
        title: "Memory keeps variance context durable",
        detail:
          "Owletto saves the account, variance, source transactions, and reporting destination so the next close starts with history.",
        chips: ["variance memory", "reporting context"],
      },
    ],
    outcome: [
      "A structured explanation for the variance",
      "Operator-ready notes for the month-end deck",
      "Shared finance context across reconciliation runs",
    ],
  },
  sales: {
    request:
      "What changed in Northstar before the October renewal, and what should we do next?",
    summary:
      "Combine revenue signals, rollout context, and shared account memory so teams can act before renewal risk grows.",
    steps: [
      {
        title: "Runtime works the live account question",
        detail:
          "Lobu answers from chat, runs the revenue workflow in a sandbox, and can request approval before any external action.",
        chips: ["chat", "sandbox", "approval flow"],
      },
      {
        title: "Skills package the GTM systems",
        detail:
          "The sales bundle can pull CRM, call, and account-health signals through one installable unit.",
        chips: ["Salesforce", "Gong", "HubSpot"],
      },
      {
        title: "Memory tracks the account graph",
        detail:
          "Owletto stores the account, region, pilot, and renewal-risk signals so commercial context compounds over time.",
        chips: ["account memory", "renewal risk"],
      },
    ],
    outcome: [
      "Renewal summaries grounded in account evidence",
      "Expansion and risk signals in one place",
      "Shared context across sales, CS, and leadership",
    ],
  },
  delivery: {
    request:
      "Give me the Monday Phoenix rollout update with blockers, owners, and the next escalation.",
    summary:
      "Use one delivery workflow to inspect live rollout tools, summarize blockers, and keep the project graph fresh.",
    steps: [
      {
        title: "Runtime drives the live status update",
        detail:
          "Lobu runs the delivery assistant in chat, pulls the current state, and keeps execution inside your infrastructure.",
        chips: ["chat", "self-hosted", "sandbox"],
      },
      {
        title: "Skills bundle rollout systems",
        detail:
          "The delivery bundle connects issue tracking, source control, and docs so one install brings the full workflow.",
        chips: ["Linear", "GitHub", "docs"],
      },
      {
        title: "Memory preserves the project graph",
        detail:
          "Owletto stores milestones, blockers, stakeholders, and artifacts so every update starts from current project context.",
        chips: ["project memory", "blockers", "owners"],
      },
    ],
    outcome: [
      "Consistent rollout updates with owners and blockers",
      "Project context that survives across standups and escalations",
      "A reusable project graph for planning and reporting",
    ],
  },
  leadership: {
    request:
      "Summarize this board memo: what was approved, what is blocked, and who owns the next action?",
    summary:
      "Turn executive materials into a workflow where agents can answer live questions and keep decision context durable.",
    steps: [
      {
        title: "Runtime handles the active executive request",
        detail:
          "Lobu processes the memo or chat message in a sandbox, applies the right instructions, and returns an operator-ready summary.",
        chips: ["docs", "chat", "sandbox"],
      },
      {
        title: "Skills package the source systems",
        detail:
          "The leadership bundle can reach board materials, shared docs, and meeting-note tools through one installable workflow.",
        chips: ["Google Drive", "meeting notes", "board packets"],
      },
      {
        title: "Memory keeps decision history reusable",
        detail:
          "Owletto stores decisions, blockers, regions, and assignments so future executive reviews start with the same context.",
        chips: ["decision memory", "assignments", "blockers"],
      },
    ],
    outcome: [
      "Action-oriented board summaries grounded in source material",
      "Durable decision history across review cycles",
      "Clear owners and blockers for follow-up work",
    ],
  },
  "agent-community": {
    request:
      "Who in the community should Sarah meet this week, and draft intro messages for the best two matches.",
    summary:
      "Build a private member graph from connected professional profiles, then use watcher-driven opportunity matching to turn launches, posts, and project updates into warm introductions.",
    steps: [
      {
        title: "Runtime handles member matching safely",
        detail:
          "Lobu runs the community workflow in a sandbox, answers matching questions in chat, and asks for approval before any outreach is sent.",
        chips: ["Slack", "email", "approval flow"],
      },
      {
        title: "Skills package member connectors",
        detail:
          "The community bundle connects GitHub, LinkedIn, newsletters, websites, and manual profile imports through one installable workflow.",
        chips: ["GitHub", "LinkedIn", "Substack", "profile imports"],
      },
      {
        title: "Memory keeps the member graph current",
        detail:
          "Owletto stores members, companies, projects, topics, and match history so new launches, posts, and project updates can trigger relevant intros instead of manual research.",
        chips: ["member graph", "connected profiles", "intro history"],
      },
    ],
    outcome: [
      "Higher-quality member discovery and introductions",
      "Fresh profile context without manual curation",
      "Approved outreach with durable match history",
    ],
  },
  "market-intelligence": {
    request:
      "What's new with Airtable this week, and how do they compare to Notion?",
    summary:
      "Track brands and products across the competitive landscape so teams can reuse market intelligence in every conversation.",
    steps: [
      {
        title: "Runtime gathers market signals",
        detail:
          "Lobu monitors brands, products, and competitive positioning from news, reviews, and social channels in a sandbox.",
        chips: ["Product Hunt", "Crunchbase", "reviews", "social"],
      },
      {
        title: "Skills package market research tools",
        detail:
          "The market intelligence skill bundles content monitors, research databases, and comparison tools through one installable unit.",
        chips: ["web monitoring", "Crunchbase", "comparison"],
      },
      {
        title: "Memory builds the brand graph",
        detail:
          "Owletto stores brands, products, mentions, and positioning so every competitive analysis starts with the same evidence.",
        chips: ["brand memory", "mentions", "positioning"],
      },
    ],
    outcome: [
      "Weekly competitive scans with feature and pricing changes",
      "Durable brand and product memory for pattern recognition",
      "Shared market context across product and strategy teams",
    ],
  },
  ecommerce: {
    request:
      "Switch Emma's subscription from monthly to annual and skip next month's delivery.",
    summary:
      "Automate subscription management and order operations so customers get fast resolution and the team keeps full context.",
    steps: [
      {
        title: "Runtime handles the customer request",
        detail:
          "Lobu receives the request in chat, pulls the customer's subscription and order state, and asks for approval before making changes.",
        chips: ["Slack", "WhatsApp", "approval flow"],
      },
      {
        title: "Skills connect the store systems",
        detail:
          "The ecommerce skill bundles Shopify, subscription management, and customer tools through one installable workflow.",
        chips: ["Shopify", "Recharge", "customer tools"],
      },
      {
        title: "Memory preserves the customer graph",
        detail:
          "Owletto stores customers, subscriptions, orders, and preferences so every interaction starts with full purchase context.",
        chips: ["customer memory", "subscriptions", "preferences"],
      },
    ],
    outcome: [
      "Faster subscription and order changes with approval flows",
      "Customer context that persists across interactions",
      "Shared memory across support, sales, and operations",
    ],
  },
  careops: {
    request:
      "Check James McManus's appointment status and summarize his treatment progress.",
    summary:
      "Coordinate patient care across therapists, appointments, and treatment plans so clinical context is always available.",
    steps: [
      {
        title: "Runtime accesses care systems",
        detail:
          "Lobu checks calendars, EHR systems, and patient portals in a sandbox and can request approval before any sensitive access.",
        chips: ["EHR", "calendars", "patient portals"],
      },
      {
        title: "Skills bundle care coordination tools",
        detail:
          "The careops bundle connects scheduling, treatment tracking, and insurance verification through one installable unit.",
        chips: ["calendar sync", "EHR integration", "insurance"],
      },
      {
        title: "Memory preserves the care graph",
        detail:
          "Owletto stores patients, appointments, treatments, and therapist assignments so care coordination continues across handoffs.",
        chips: ["patient memory", "therapists", "treatments"],
      },
    ],
    outcome: [
      "Current patient status and appointment availability",
      "Treatment progress summaries across sessions",
      "Shared care coordination across clinical staff",
    ],
  },
  "venture-capital": {
    request:
      "What's the latest on Lovable, and what other AI dev tools should we track?",
    summary:
      "Combine portfolio tracking, deal sourcing, and market signals so investment teams can reuse company context.",
    steps: [
      {
        title: "Runtime checks portfolio and pipeline",
        detail:
          "Lobu pulls company data, funding rounds, and market signals from multiple sources in a sandbox.",
        chips: ["Crunchbase", "LinkedIn", "news feeds"],
      },
      {
        title: "Skills package deal flow tools",
        detail:
          "The VC skill bundles company databases, founder tracking, and market monitoring through one installable unit.",
        chips: ["deal tracking", "founder research", "market scans"],
      },
      {
        title: "Memory builds the venture graph",
        detail:
          "Owletto stores companies, founders, investors, and sectors so deal context compounds over time.",
        chips: ["portfolio memory", "deal flow", "network"],
      },
    ],
    outcome: [
      "Company summaries with funding and team history",
      "Portfolio health and competitive signals",
      "Shared context across partners and associates",
    ],
  },
};

function enrichMemory(
  useCaseId: LandingUseCaseId,
  memory: LandingUseCaseDefinition["memory"]
): LandingUseCaseDefinition["memory"] {
  return {
    ...memory,
    howItWorks: memory.howItWorks.map((step) => ({
      ...step,
      links:
        step.id === "model"
          ? [...(step.links ?? []), docsLinks.owlettoDocs]
          : step.id === "reuse"
            ? [
                ...(step.links ?? []),
                {
                  label: "How skills work →",
                  href: `/skills/for/${useCaseId}`,
                },
              ]
            : step.links,
      panel:
        step.panel ??
        (step.id === "connect" || step.id === "auth" || step.id === "reuse"
          ? memoryStepPanels[useCaseId][step.id]
          : undefined),
    })),
  };
}

function toSkillPreview(
  useCaseId: LandingUseCaseId,
  useCase: LandingUseCaseDefinition
): ShowcaseSkillWorkspacePreview {
  const { skills } = useCase;

  return {
    useCaseId,
    examplePath: useCase.examplePath,
    name: useCase.label,
    description: skills.description,
    agentId: skills.agentId,
    skillId: skills.skillId,
    skills: skills.skills,
    nixPackages: skills.nixPackages,
    allowedDomains: skills.allowedDomains,
    mcpServer: skills.mcpServer,
    providerId: skills.providerId,
    model: skills.model,
    apiKeyEnv: skills.apiKeyEnv,
    identity: useCase.agent.identity,
    soul: useCase.agent.soul,
    user: useCase.agent.user,
    skillInstructions: skills.skillInstructions,
  };
}

function toMemoryExample(
  useCaseId: LandingUseCaseId,
  useCase: LandingUseCaseDefinition
): ShowcaseMemoryExample {
  const memory = enrichMemory(useCaseId, useCase.memory);

  return {
    useCaseId,
    examplePath: useCase.examplePath,
    id: memory.id,
    tab: useCase.label,
    title: useCase.label,
    description: memory.description,
    sourceLabel: memory.sourceLabel,
    sourceText: memory.sourceText,
    entityTypes: useCase.model.entities,
    entitySelections: memory.entitySelections,
    howItWorks: memory.howItWorks,
    highlights: memory.highlights,
    nodeHighlights: memory.nodeHighlights,
    watcher: memory.watcher,
    recordTree: memory.recordTree,
    relations: memory.relations,
  };
}

function toCampaignMeta(
  useCaseId: LandingUseCaseId,
  useCase: LandingUseCaseDefinition,
  runtime: RuntimeJourneyInput
): CampaignMeta {
  return {
    title: `Deploy secure ${useCase.label.toLowerCase()} agents in your infrastructure`,
    description: runtime.summary,
    seoTitle: `${useCase.label} AI agents on your infrastructure - Lobu`,
    seoDescription: runtime.summary,
    ctaHref: `/for/${useCaseId}`,
    ctaLabel: `Open ${useCase.label} page`,
  };
}

export const landingUseCaseShowcases: LandingUseCaseShowcase[] = (
  Object.entries(landingUseCases) as Array<
    [LandingUseCaseId, LandingUseCaseDefinition]
  >
).map(([useCaseId, useCase]) => {
  const input = runtimeContent[useCaseId];
  const runtime: RuntimeJourney = {
    ...input,
    requestLabel: "Incoming request",
    outcomeLabel: "What the team gets",
  };

  return {
    id: useCaseId,
    label: useCase.label,
    examplePath: useCase.examplePath,
    campaign: toCampaignMeta(useCaseId, useCase, input),
    runtime,
    skills: toSkillPreview(useCaseId, useCase),
    memory: toMemoryExample(useCaseId, useCase),
  };
});

export const DEFAULT_LANDING_USE_CASE_ID: LandingUseCaseId = "devops";

export const landingUseCaseOptions = landingUseCaseShowcases.map((useCase) => ({
  id: useCase.id,
  label: useCase.label,
}));

export function getLandingUseCaseShowcase(
  useCaseId?: string
): LandingUseCaseShowcase {
  return (
    landingUseCaseShowcases.find((useCase) => useCase.id === useCaseId) ??
    landingUseCaseShowcases.find(
      (useCase) => useCase.id === DEFAULT_LANDING_USE_CASE_ID
    ) ??
    landingUseCaseShowcases[0]
  );
}

export const showcaseSkillWorkspacePreviews = landingUseCaseShowcases.map(
  (useCase) => useCase.skills
);

export const showcaseMemoryExamples = landingUseCaseShowcases.map(
  (useCase) => useCase.memory
);

export function getSkillsPrompt(showcase: LandingUseCaseShowcase) {
  const workspace = showcase.skills;

  return `Set up a new Lobu agent for ${showcase.label}. Create lobu.toml with [agents.${workspace.agentId}] pointing at ./agents/${workspace.agentId}, add IDENTITY.md, SOUL.md, and USER.md under agents/${workspace.agentId}/, and add a shared skill in skills/${workspace.skillId}/SKILL.md with nix packages, a network allowlist, and MCP servers for ${workspace.skills.join(", ")}. Keep tool policy in lobu.toml. Keep the workflow aligned with this request: ${showcase.runtime.request}`;
}

export function getMemoryPrompt(showcase: LandingUseCaseShowcase) {
  const memory = showcase.memory;

  return `Initialize Owletto memory for ${showcase.label}. Model these entities: ${memory.entityTypes.join(", ")}. Use this source text as the first example: "${memory.sourceText}". Keep the extracted memory durable, typed, and linked so the runtime can reuse it across future tasks.`;
}

const OWLETTO_URL = "https://owletto.com";

export function getOwlettoUrl(useCaseId?: LandingUseCaseId) {
  if (!useCaseId) return OWLETTO_URL;
  const def = landingUseCases[useCaseId];
  if ("owlettoOrg" in def && def.owlettoOrg) {
    return `${OWLETTO_URL}/${def.owlettoOrg}`;
  }
  return OWLETTO_URL;
}
