export type MemoryField = {
  label: string;
  value: string;
};

export type RecordNode = {
  id: string;
  label: string;
  kind: string;
  summary: string;
  chips?: string[];
  children?: RecordNode[];
};

export type ExampleRelation = {
  source: string;
  sourceType: string;
  label: string;
  target: string;
  targetType: string;
  note: string;
};

export type ExampleLink = {
  label: string;
  href: string;
};

export type HowItWorksPanelItem = {
  label: string;
  detail: string;
  meta?: string;
  platform?: {
    id: "slack" | "openclaw" | "chatgpt" | "claude";
    label: string;
  };
};

export type HowItWorksPanelTable = {
  columns: string[];
  rows: string[][];
};

export type HowItWorksPanel = {
  title: string;
  description?: string;
  items?: HowItWorksPanelItem[];
  table?: HowItWorksPanelTable;
};

export type HowItWorksStep = {
  id: "model" | "connect" | "auth" | "reuse" | "fresh";
  label: string;
  title: string;
  detail: string;
  chips?: string[];
  links?: ExampleLink[];
  panel?: HowItWorksPanel;
};

export type MemoryExample = {
  id: string;
  tab: string;
  title: string;
  description: string;
  sourceLabel: string;
  sourceText: string;
  entityTypes: string[];
  entitySelections?: Record<string, string>;
  howItWorks: HowItWorksStep[];
  highlights: MemoryField[];
  nodeHighlights?: Record<string, MemoryField[]>;
  watcher: {
    name: string;
    schedule: string;
    prompt: string;
    extractionSchema: string;
    schemaEvolution: string;
  };
  recordTree: RecordNode;
  relations: ExampleRelation[];
};

export type SkillWorkspacePreviewData = {
  name: string;
  description: string;
  agentId: string;
  skillId: string;
  skills: string[];
  nixPackages: string[];
  allowedDomains: string[];
  mcpServer: string;
  providerId: string;
  model: string;
  apiKeyEnv: string;
  identity: string[];
  soul: string[];
  user: string[];
  skillInstructions: string[];
};

export type LandingUseCaseAgentDefinition = {
  identity: string[];
  soul: string[];
  user: string[];
};

export type LandingUseCaseModelDefinition = {
  entities: string[];
  relationships: Array<{
    label: string;
    note: string;
  }>;
};

export type LandingUseCaseSkillsDefinition = {
  description: string;
  agentId: string;
  skillId: string;
  skills: string[];
  nixPackages: string[];
  allowedDomains: string[];
  mcpServer: string;
  providerId: string;
  model: string;
  apiKeyEnv: string;
  skillInstructions: string[];
};

export type LandingUseCaseMemoryDefinition = {
  id: string;
  description: string;
  sourceLabel: string;
  sourceText: string;
  entitySelections?: Record<string, string>;
  howItWorks: HowItWorksStep[];
  highlights: MemoryField[];
  nodeHighlights?: Record<string, MemoryField[]>;
  watcher: {
    name: string;
    schedule: string;
    prompt: string;
    extractionSchema: string;
    schemaEvolution: string;
  };
  recordTree: RecordNode;
  relations: ExampleRelation[];
};

export type LandingUseCaseDefinition = {
  id: string;
  label: string;
  examplePath: string;
  agent: LandingUseCaseAgentDefinition;
  model: LandingUseCaseModelDefinition;
  skills?: LandingUseCaseSkillsDefinition;
  memory?: LandingUseCaseMemoryDefinition;
  owlettoOrg?: string;
};

export const technicalLinks = {
  mcpProxy: { label: "MCP proxy", href: "/guides/mcp-proxy/" },
  connectorSdk: {
    label: "Connector SDK",
    href: "/reference/owletto-cli/#connector-sdk",
  },
  memoryDocs: { label: "Memory docs", href: "/getting-started/memory/" },
  mcpAuthFlow: { label: "MCP auth flow", href: "/guides/mcp-proxy/" },
};

export const landingUseCases = {
  legal: {
    id: "legal",
    label: "Legal",
    examplePath: "legal",
    agent: {
      identity: [
        "You review contracts, summarize risk, and surface missing protections.",
        "Support legal teams with fast clause analysis and cited research notes.",
      ],
      soul: [
        "- Be precise and cautious.",
        "- Separate facts, risks, and recommendations.",
        "- Flag language that needs counsel approval.",
      ],
      user: [
        "- Team: Commercial legal",
        "- Priority: Turn NDAs around quickly",
        "- Preference: Redlines with short rationale",
      ],
    },
    model: {
      entities: ["Contract", "Clause", "Risk", "Counterparty"],
      relationships: [
        {
          label: "contains_clause",
          note: "Represent how a contract is composed so risky language stays attached to the right section.",
        },
        {
          label: "creates_risk",
          note: "Keep legal risk linked to the clause or term that caused it.",
        },
        {
          label: "belongs_to_counterparty",
          note: "Tie agreements and negotiation context back to the right external party.",
        },
      ],
    },
    skills: {
      description: "Draft contracts, search case law, review clauses",
      agentId: "legal-review",
      skillId: "legal-review",
      skills: ["westlaw-mcp", "contract-drafter", "case-search"],
      nixPackages: ["poppler", "ripgrep"],
      allowedDomains: ["api.westlaw.com", ".courtlistener.com"],
      mcpServer: "westlaw-mcp",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Summarize material risk before drafting edits.",
        "Cite authority or precedent when recommending changes.",
      ],
    },
  },
  devops: {
    id: "devops",
    label: "DevOps",
    examplePath: "devops",
    agent: {
      identity: [
        "You help platform teams triage incidents, reviews, and deploy safety checks.",
        "Keep humans aligned on what is broken, blocked, or ready to ship.",
      ],
      soul: [
        "- Prefer signal over noise.",
        "- Highlight user impact and rollout risk.",
        "- Never auto-deploy without approval.",
      ],
      user: [
        "- Team: Platform engineering",
        "- Rotation: Primary on-call this week",
        "- Preference: Incident-first summaries",
      ],
    },
    model: {
      entities: ["Incident", "Service", "Deploy", "Pull request"],
      relationships: [
        {
          label: "affects_service",
          note: "Attach incidents to the systems they degrade so impact stays visible.",
        },
        {
          label: "triggered_by_deploy",
          note: "Link operational events back to the rollout or config change that caused them.",
        },
        {
          label: "blocked_by_pr",
          note: "Keep remediation work connected to the code changes that need action.",
        },
      ],
    },
    skills: {
      description: "Triage PRs, manage incidents, deploy services",
      agentId: "devops-control",
      skillId: "devops-control",
      skills: ["github-mcp", "pagerduty-mcp", "k8s-tools"],
      nixPackages: ["gh", "kubectl", "jq"],
      allowedDomains: [
        "api.github.com",
        "api.pagerduty.com",
        ".k8s.example.com",
      ],
      mcpServer: "github-mcp",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Start with active incidents, then pending reviews and deploys.",
        "Call out rollback steps when release risk is high.",
      ],
    },
  },
  support: {
    id: "support",
    label: "Support",
    examplePath: "support",
    agent: {
      identity: [
        "You help support teams route tickets, draft replies, and escalate urgent issues.",
        "Balance empathy with fast, accurate resolution paths.",
      ],
      soul: [
        "- Be calm and helpful.",
        "- Confirm what the customer needs next.",
        "- Escalate outages or billing risk immediately.",
      ],
      user: [
        "- Team: Support operations",
        "- SLA: First reply under 15 minutes",
        "- Preference: Reusable macros where possible",
      ],
    },
    model: {
      entities: ["Person", "Organization", "Preference", "Task"],
      relationships: [
        {
          label: "works_at",
          note: "Link contacts to the companies and accounts they represent.",
        },
        {
          label: "prefers",
          note: "Persist communication preferences so future replies stay aligned.",
        },
        {
          label: "created_task",
          note: "Turn requests and promises into follow-ups with clear ownership.",
        },
      ],
    },
    skills: {
      description: "Route tickets, draft responses, escalate issues",
      agentId: "support-desk",
      skillId: "support-desk",
      skills: ["zendesk-mcp", "knowledge-base", "sentiment"],
      nixPackages: ["jq", "ripgrep"],
      allowedDomains: ["subdomain.zendesk.com", ".intercomcdn.com"],
      mcpServer: "zendesk-mcp",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Propose the next best reply and the internal follow-up owner.",
        "Detect sentiment shifts before queues back up.",
      ],
    },
    memory: {
      id: "person",
      description:
        "Remember contacts, preferences, owners, and follow-ups across conversations.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that Alex Kim from Acme Health owns vendor onboarding, prefers weekly email summaries, and asked us to send the draft by Thursday.",
      entitySelections: {
        Person: "person-entity",
        Organization: "person-org",
        Preference: "person-attribute-preference",
        Task: "person-task",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the world",
          detail:
            "Define the people, organizations, preferences, and follow-ups your agents should recognize across conversations and synced contact data.",
          chips: ["Person", "Organization", "Preference", "Task"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Proxy MCP servers and ingest contact context from messaging apps, CRM syncs, email, and custom Connector SDK integrations through one runtime.",
          chips: ["Slack", "CRM sync", "Email", "Custom SDK", "MCP proxy"],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Support OAuth for inbox and calendar context, API keys for internal tools, and imports for historical contacts without exposing credentials to agents.",
          chips: ["OAuth", "API keys", "CSV import", "Manual import"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context across agents",
          detail:
            "The same relationship memory powers support agents wherever teams work.",
          chips: ["Slack", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers monitor new activity and update ownership, preferences, and follow-ups as the relationship changes.",
        },
      ],
      watcher: {
        name: "Contact freshness",
        schedule: "Every 24 hours",
        prompt:
          "Monitor Alex Kim's organization for role changes, new preferences, and overdue follow-ups.",
        extractionSchema:
          "{ status, role_changed, new_preferences[], overdue_tasks[] }",
        schemaEvolution:
          "Started with name + role. After 3 runs, added preference_history and follow_up_urgency as new patterns emerged.",
      },
      highlights: [
        { label: "Primary person", value: "Alex Kim" },
        { label: "Role", value: "Vendor onboarding owner" },
        { label: "Preference", value: "Weekly email summaries" },
        { label: "Follow-up", value: "Send draft by Thursday" },
      ],
      nodeHighlights: {
        "person-root": [
          { label: "Primary person", value: "Alex Kim" },
          { label: "Organization", value: "Acme Health" },
          { label: "Preference", value: "Weekly email summaries" },
          { label: "Follow-up", value: "Send draft by Thursday" },
        ],
        "person-entity": [
          { label: "Type", value: "Person" },
          { label: "Name", value: "Alex Kim" },
          { label: "Role", value: "Vendor onboarding owner" },
          { label: "Works at", value: "Acme Health" },
        ],
        "person-attribute-role": [
          { label: "Field", value: "role" },
          { label: "Type", value: "string" },
          { label: "Value", value: "Vendor onboarding owner" },
          { label: "Source phrase", value: "owns vendor onboarding" },
        ],
        "person-attribute-preference": [
          { label: "Field", value: "communication_preference" },
          { label: "Type", value: "string" },
          { label: "Value", value: "Weekly email summaries" },
          { label: "Applies to", value: "Future follow-ups and reports" },
        ],
        "person-org": [
          { label: "Relationship", value: "works_at" },
          { label: "Source", value: "Alex Kim" },
          { label: "Target", value: "Acme Health" },
          {
            label: "Why it matters",
            value: "Connects contact memory to org context",
          },
        ],
        "person-task": [
          { label: "Type", value: "Task" },
          { label: "Action", value: "Send draft" },
          { label: "Due", value: "Thursday" },
          { label: "Source", value: "Alex Kim follow-up request" },
        ],
      },
      recordTree: {
        id: "person-root",
        label: "Record: Alex Kim memory update",
        kind: "Model record",
        summary:
          "One incoming message produces a primary person node, linked organization, durable preference, and a follow-up task.",
        chips: ["append-only", "reviewed", "workspace-scoped"],
        children: [
          {
            id: "person-entity",
            label: "Entity: Alex Kim",
            kind: "Person",
            summary:
              "Primary contact with role ownership and source-linked facts that can be reused across threads.",
            chips: ["primary", "person", "owner"],
            children: [
              {
                id: "person-attribute-role",
                label: "Attribute: role",
                kind: "Field",
                summary:
                  "Normalized to 'vendor onboarding owner' from natural language 'owns vendor onboarding'.",
                chips: ["normalized", "derived"],
              },
              {
                id: "person-attribute-preference",
                label: "Attribute: communication preference",
                kind: "Field",
                summary:
                  "Stored as a reusable preference so future agents choose the right delivery style automatically.",
                chips: ["durable", "preference"],
              },
            ],
          },
          {
            id: "person-org",
            label: "Relationship: works at Acme Health",
            kind: "Relationship",
            summary:
              "Links the person node to the organization node so both records benefit from the same evidence chain.",
            chips: ["relationship", "organization"],
          },
          {
            id: "person-task",
            label: "Task: send draft by Thursday",
            kind: "Operational memory",
            summary:
              "Follow-up stored with source reference so agents can act on it and explain where it came from.",
            chips: ["actionable", "deadline"],
          },
        ],
      },
      relations: [
        {
          source: "Alex Kim",
          sourceType: "person",
          label: "works_at",
          target: "Acme Health",
          targetType: "organization",
          note: "Organization affiliation extracted directly from the meeting note.",
        },
        {
          source: "Alex Kim",
          sourceType: "person",
          label: "prefers",
          target: "Weekly email summaries",
          targetType: "preference",
          note: "Stored as a durable preference for future agent behavior.",
        },
        {
          source: "Q3 planning call",
          sourceType: "task",
          label: "created_task",
          target: "Send draft by Thursday",
          targetType: "task",
          note: "Operational memory stays attached to the originating event.",
        },
      ],
    },
  },
  finance: {
    id: "finance",
    label: "Finance",
    examplePath: "finance",
    agent: {
      identity: [
        "You help finance teams reconcile data, explain variance, and prepare reporting runs.",
        "Spot anomalies early and summarize them in operator language.",
      ],
      soul: [
        "- Be exact with numbers and dates.",
        "- Separate confirmed variance from possible causes.",
        "- Escalate payment risk quickly.",
      ],
      user: [
        "- Team: Finance ops",
        "- Close: Month-end in progress",
        "- Preference: Clear exceptions list",
      ],
    },
    model: {
      entities: ["Account", "Transaction", "Variance", "Report"],
      relationships: [
        {
          label: "reconciles_to",
          note: "Tie transactions and balances back to the accounts they roll into.",
        },
        {
          label: "creates_variance",
          note: "Keep anomalies attached to the source records that produced them.",
        },
        {
          label: "summarized_in",
          note: "Let agents trace reporting outputs back to the supporting data.",
        },
      ],
    },
    skills: {
      description: "Reconcile accounts, generate reports, flag anomalies",
      agentId: "finance-ops",
      skillId: "finance-ops",
      skills: ["quickbooks-mcp", "stripe-mcp", "csv-tools"],
      nixPackages: ["qsv", "jq", "sqlite"],
      allowedDomains: ["quickbooks.api.intuit.com", "api.stripe.com"],
      mcpServer: "stripe-mcp",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Lead with exceptions, then summarize reconciled balances.",
        "Prepare operator-ready notes for anomalies that need review.",
      ],
    },
  },
  sales: {
    id: "sales",
    label: "Sales",
    examplePath: "sales",
    agent: {
      identity: [
        "You help revenue teams track account health, rollout progress, and renewal signals.",
        "Keep every commercial update tied to the people, products, and risks behind it.",
      ],
      soul: [
        "- Focus on what changes account trajectory.",
        "- Separate confirmed signals from speculation.",
        "- Flag renewal risk early and clearly.",
      ],
      user: [
        "- Team: Revenue operations",
        "- Priority: Protect renewals and identify expansion",
        "- Preference: Account summaries with clear next steps",
      ],
    },
    model: {
      entities: ["Organization", "Region", "Team", "Product", "Renewal risk"],
      relationships: [
        {
          label: "expanded_into",
          note: "Track where an account is growing so territory and rollout context stay explicit.",
        },
        {
          label: "runs",
          note: "Link the internal team or customer function to the pilot they own.",
        },
        {
          label: "affects",
          note: "Connect commercial signals directly to the renewal or expansion they influence.",
        },
      ],
    },
    memory: {
      id: "company",
      description: "Track accounts, pilots, renewal risk, and buying signals.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that Northstar Foods expanded into EMEA, launched the Warehouse OS pilot under the Operations team, and raised a pricing concern ahead of the October renewal.",
      entitySelections: {
        Organization: "company-entity",
        Region: "company-region",
        Team: "company-team",
        Product: "company-pilot",
        "Renewal risk": "company-risk",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the world",
          detail:
            "Represent accounts as organizations with regions, teams, pilots, and risks instead of flattening everything into CRM notes.",
          chips: ["Organization", "Region", "Team", "Product", "Renewal risk"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest CRM updates, product telemetry, support signals, and internal notes through supported connectors, MCP proxying, and custom SDK integrations.",
          chips: [
            "CRM",
            "Product events",
            "Support data",
            "Internal notes",
            "Custom SDK",
          ],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Mix OAuth for SaaS apps, API keys for services, and service accounts for internal pipelines while keeping credentials scoped outside the agent runtime.",
          chips: ["OAuth", "API keys", "Service account", "Scheduled imports"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context across agents",
          detail:
            "The same account memory powers revenue agents wherever teams work.",
          chips: ["Slack", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers turn ongoing account changes into updated risk, expansion, and renewal state without rewriting the whole record by hand.",
        },
      ],
      watcher: {
        name: "Account health monitor",
        schedule: "Every 12 hours",
        prompt:
          "Poll CRM data for Northstar Foods. Track expansion progress, risk level changes, and renewal timeline.",
        extractionSchema:
          "{ risk_level, expansion_status, renewal_blockers[], activity_delta }",
        schemaEvolution:
          "Started with risk_level + renewal_date. After processing EMEA expansion data, added region_status and pilot_health fields automatically.",
      },
      highlights: [
        { label: "Organization", value: "Northstar Foods" },
        { label: "Expansion", value: "EMEA" },
        { label: "Pilot", value: "Warehouse OS" },
        {
          label: "Commercial signal",
          value: "Pricing concern before October renewal",
        },
      ],
      nodeHighlights: {
        "company-root": [
          { label: "Organization", value: "Northstar Foods" },
          { label: "Expansion", value: "EMEA" },
          { label: "Pilot", value: "Warehouse OS" },
          { label: "Renewal signal", value: "Pricing concern before October" },
        ],
        "company-entity": [
          { label: "Type", value: "Organization" },
          { label: "Name", value: "Northstar Foods" },
          { label: "Expansion region", value: "EMEA" },
          { label: "Owner team", value: "Operations" },
        ],
        "company-region": [
          { label: "Node type", value: "Geography" },
          { label: "Region", value: "EMEA" },
          { label: "Status", value: "Expanded into" },
          { label: "Parent", value: "Northstar Foods" },
        ],
        "company-team": [
          { label: "Node type", value: "Team" },
          { label: "Team", value: "Operations" },
          { label: "Owns", value: "Warehouse OS pilot" },
          { label: "Role", value: "Pilot operator" },
        ],
        "company-pilot": [
          { label: "Type", value: "Product rollout" },
          { label: "Name", value: "Warehouse OS pilot" },
          { label: "Owner", value: "Operations team" },
          { label: "Account", value: "Northstar Foods" },
        ],
        "company-risk": [
          { label: "Type", value: "Renewal risk" },
          { label: "Signal", value: "Pricing concern" },
          { label: "Affects", value: "October renewal" },
          { label: "Severity", value: "Needs follow-up" },
        ],
      },
      recordTree: {
        id: "company-root",
        label: "Record: Northstar Foods update",
        kind: "Model record",
        summary:
          "One sync note expands the company node with geography, internal team structure, product rollout state, and renewal risk.",
        chips: ["org graph", "timelined", "inspectable"],
        children: [
          {
            id: "company-entity",
            label: "Entity: Northstar Foods",
            kind: "Organization",
            summary:
              "The primary organization node accumulates account context instead of scattering it across separate summaries.",
            chips: ["primary", "account"],
            children: [
              {
                id: "company-region",
                label: "Child node: EMEA expansion",
                kind: "Geography",
                summary:
                  "Region expansion modeled as structured company growth metadata, not buried inside free text.",
                chips: ["hierarchy", "region"],
              },
              {
                id: "company-team",
                label: "Child node: Operations team",
                kind: "Team",
                summary:
                  "Internal org structure lets the memory graph represent where pilots and issues actually live.",
                chips: ["team", "owner"],
              },
            ],
          },
          {
            id: "company-pilot",
            label: "Entity: Warehouse OS pilot",
            kind: "Product rollout",
            summary:
              "The pilot is tracked as its own typed object with state, owner, and relationship back to the company account.",
            chips: ["product", "stateful"],
          },
          {
            id: "company-risk",
            label: "Entity: pricing concern",
            kind: "Renewal risk",
            summary:
              "Commercial risk is separated from the raw note so success or sales agents can query it directly later.",
            chips: ["risk", "renewal"],
          },
        ],
      },
      relations: [
        {
          source: "Northstar Foods",
          sourceType: "organization",
          label: "expanded_into",
          target: "EMEA",
          targetType: "region",
          note: "Regional growth becomes part of the organization hierarchy.",
        },
        {
          source: "Operations team",
          sourceType: "team",
          label: "runs",
          target: "Warehouse OS pilot",
          targetType: "product",
          note: "Owning team provides retrieval context for future planning questions.",
        },
        {
          source: "Pricing concern",
          sourceType: "renewal-risk",
          label: "affects",
          target: "October renewal",
          targetType: "renewal",
          note: "Temporal linkage makes the signal useful for upcoming workflows.",
        },
      ],
    },
  },
  delivery: {
    id: "delivery",
    label: "Delivery",
    examplePath: "delivery",
    agent: {
      identity: [
        "You help delivery teams keep milestones, blockers, owners, and artifacts aligned.",
        "Turn operational updates into reusable project context instead of one-off status notes.",
      ],
      soul: [
        "- Lead with blockers and dependencies.",
        "- Preserve ownership and evidence.",
        "- Keep leadership updates concise and factual.",
      ],
      user: [
        "- Team: Delivery operations",
        "- Priority: Keep rollouts unblocked",
        "- Preference: Weekly risk snapshots",
      ],
    },
    model: {
      entities: ["Project", "Milestone", "Stakeholder", "Blocker", "Document"],
      relationships: [
        {
          label: "owned_by",
          note: "Keep project ownership queryable across updates and artifacts.",
        },
        {
          label: "blocked_by",
          note: "Tie blockers directly to the project and milestone they threaten.",
        },
        {
          label: "documented_in",
          note: "Preserve the source documents and reviews behind key project state.",
        },
      ],
    },
    memory: {
      id: "project",
      description:
        "Keep milestones, blockers, owners, and reporting context in one shared record.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that Phoenix migration is in phase two, Maya owns the rollout, infra is blocking the SSO cutover, the design review is in the launch doc, and leadership wants a risk update every Monday.",
      entitySelections: {
        Project: "project-node",
        Milestone: "project-phase",
        Stakeholder: "project-owner",
        Blocker: "project-blocker",
        Document: "project-doc",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the world",
          detail:
            "Treat projects as first-class objects with milestones, owners, blockers, artifacts, and recurring reporting expectations.",
          chips: ["Project", "Milestone", "Stakeholder", "Blocker", "Document"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Bring project state in from GitHub, Linear, Slack, docs, and internal app events through MCP proxying or custom Connector SDKs.",
          chips: ["GitHub", "Linear", "Slack", "Docs", "Custom SDK"],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Support OAuth for engineering tools, API keys for internal services, and source-specific imports for historical project state and artifacts.",
          chips: ["OAuth", "API keys", "Webhooks", "Manual import"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context across agents",
          detail:
            "The same project memory powers delivery agents wherever teams work.",
          chips: ["Slack", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers turn new blockers, milestone changes, and reporting cadences into updated project memory and ready-to-send summaries.",
        },
      ],
      watcher: {
        name: "Phoenix rollout tracker",
        schedule: "Every Monday at 9 AM",
        prompt:
          "Check Phoenix migration blockers, milestone progress, and generate the weekly risk summary for leadership.",
        extractionSchema:
          "{ blockers_resolved[], milestone_state, new_risks[], risk_summary }",
        schemaEvolution:
          "Started with blocker_status + phase. After the design review brief arrived, added document_references and dependency_chain fields.",
      },
      highlights: [
        { label: "Project", value: "Phoenix migration" },
        { label: "Current phase", value: "Phase two" },
        { label: "Blocker", value: "Infra blocking SSO cutover" },
        { label: "Reporting cadence", value: "Risk update every Monday" },
      ],
      nodeHighlights: {
        "project-root": [
          { label: "Project", value: "Phoenix migration" },
          { label: "Phase", value: "Phase two" },
          { label: "Owner", value: "Maya" },
          { label: "Reporting cadence", value: "Every Monday" },
        ],
        "project-node": [
          { label: "Type", value: "Project" },
          { label: "Name", value: "Phoenix migration" },
          { label: "State", value: "Phase two" },
          { label: "Owner", value: "Maya" },
        ],
        "project-phase": [
          { label: "Type", value: "Milestone" },
          { label: "Name", value: "Phase two" },
          { label: "Lifecycle", value: "In progress" },
          { label: "Parent", value: "Phoenix migration" },
        ],
        "project-blocker": [
          { label: "Type", value: "Dependency" },
          { label: "Blocker", value: "SSO cutover" },
          { label: "Owned by", value: "Infra" },
          { label: "Impact", value: "Blocks rollout progress" },
        ],
        "project-doc": [
          { label: "Type", value: "Reference" },
          { label: "Document", value: "Launch doc" },
          { label: "Contains", value: "Design review" },
          { label: "Linked to", value: "Phoenix migration" },
        ],
        "project-owner": [
          { label: "Type", value: "Person" },
          { label: "Name", value: "Maya" },
          { label: "Role", value: "Project owner" },
          { label: "Owns", value: "Phoenix migration rollout" },
        ],
        "project-cadence": [
          { label: "Type", value: "Preference" },
          { label: "Audience", value: "Leadership" },
          { label: "Update", value: "Risk summary" },
          { label: "Cadence", value: "Every Monday" },
        ],
      },
      recordTree: {
        id: "project-root",
        label: "Record: Phoenix migration state",
        kind: "Model record",
        summary:
          "Project state becomes a hierarchy of phase, owner, blocker, linked doc, and recurring leadership request.",
        chips: ["project memory", "linked artifacts", "actionable"],
        children: [
          {
            id: "project-node",
            label: "Entity: Phoenix migration",
            kind: "Project",
            summary:
              "Composite project node holding lifecycle state, stakeholders, blockers, and references in one place.",
            chips: ["primary", "project"],
            children: [
              {
                id: "project-phase",
                label: "Milestone: phase two",
                kind: "Milestone",
                summary:
                  "Lifecycle state kept as a first-class project milestone rather than a sentence fragment.",
                chips: ["state", "milestone"],
              },
              {
                id: "project-blocker",
                label: "Blocker: SSO cutover",
                kind: "Dependency",
                summary:
                  "Operational blocker linked to the owning infra function so agents can surface it automatically in updates.",
                chips: ["dependency", "risk"],
              },
              {
                id: "project-doc",
                label: "Document: launch doc",
                kind: "Reference",
                summary:
                  "The design review is attached as a document reference instead of disappearing inside an opaque note.",
                chips: ["artifact", "evidence"],
              },
            ],
          },
          {
            id: "project-owner",
            label: "Stakeholder: Maya",
            kind: "Person",
            summary:
              "Project ownership becomes directly queryable for routing follow-ups and status requests.",
            chips: ["owner", "stakeholder"],
          },
          {
            id: "project-cadence",
            label: "Preference: Monday risk update",
            kind: "Preference",
            summary:
              "Leadership reporting expectations are durable memory too, so agents can follow them consistently.",
            chips: ["cadence", "leadership"],
          },
        ],
      },
      relations: [
        {
          source: "Phoenix migration",
          sourceType: "project",
          label: "owned_by",
          target: "Maya",
          targetType: "stakeholder",
          note: "Ownership becomes a stable graph edge instead of a transient note.",
        },
        {
          source: "Phoenix migration",
          sourceType: "project",
          label: "blocked_by",
          target: "SSO cutover dependency",
          targetType: "blocker",
          note: "Operational blockers remain tied to the project for retrieval and updates.",
        },
        {
          source: "Phoenix migration",
          sourceType: "project",
          label: "documented_in",
          target: "Launch doc",
          targetType: "document",
          note: "Source artifacts stay attached to the project record.",
        },
      ],
    },
  },
  leadership: {
    id: "leadership",
    label: "Leadership",
    examplePath: "leadership",
    agent: {
      identity: [
        "You help leadership teams turn memos, decisions, and board materials into reusable operating context.",
        "Keep decisions, blockers, and assignments attached to their source evidence.",
      ],
      soul: [
        "- Preserve decision history.",
        "- Keep blockers and owners explicit.",
        "- Separate approved, pending, and blocked outcomes.",
      ],
      user: [
        "- Team: Executive operations",
        "- Priority: Preserve decision context between reviews",
        "- Preference: Action-oriented summaries",
      ],
    },
    model: {
      entities: ["Document", "Decision", "Region", "Risk", "Task"],
      relationships: [
        {
          label: "approved",
          note: "Keep approved decisions queryable without re-reading the whole source memo.",
        },
        {
          label: "blocked_by",
          note: "Attach blocked decisions to the dependency that is holding them up.",
        },
        {
          label: "assigned",
          note: "Turn follow-up work into durable ownership instead of transient notes.",
        },
      ],
    },
    memory: {
      id: "document",
      description:
        "Turn decisions, blockers, and assignments from source documents into reusable context.",
      sourceLabel: "Example prompt",
      sourceText:
        "From this board memo, remember that the LATAM expansion budget was approved, the warehouse lease decision is delayed pending legal review, and Elena needs to update the forecast for next week's board packet.",
      entitySelections: {
        Document: "document-node",
        Decision: "document-decision-approved",
        Region: "document-decision-approved",
        Risk: "document-blocker",
        Task: "document-task",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the world",
          detail:
            "Treat source files as evidence objects, then extract decisions, blockers, regions, and tasks into linked structured memory.",
          chips: ["Document", "Decision", "Region", "Risk", "Task"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest uploads, cloud docs, PDFs, browser-backed systems, and custom SDK feeds while routing MCP access through the proxy layer.",
          chips: [
            "File upload",
            "Google Drive",
            "PDFs",
            "Browser auth",
            "Custom SDK",
          ],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Let users authorize Drive and knowledge tools with OAuth, attach API-backed sources, or import documents directly when manual capture makes more sense.",
          chips: ["OAuth", "Browser auth", "API keys", "File upload"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context across agents",
          detail:
            "The same decision memory powers leadership agents wherever teams work.",
          chips: ["Slack", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers keep pending decisions, legal blockers, and assigned tasks current as new board materials and follow-ups arrive.",
        },
      ],
      watcher: {
        name: "Board action tracker",
        schedule: "Daily at 8 AM",
        prompt:
          "Track board action items: check Elena's forecast delivery, legal review status, and upcoming board packet deadlines.",
        extractionSchema:
          "{ action_items[], blocked_items[], deadlines_approaching[], completion_status }",
        schemaEvolution:
          "Started with decision_status + owner. After two board cycles, added deadline_proximity and cross-reference fields for linked decisions.",
      },
      highlights: [
        { label: "Approved", value: "LATAM expansion budget" },
        { label: "Pending", value: "Warehouse lease decision" },
        { label: "Blocker", value: "Legal review" },
        { label: "Owner", value: "Elena" },
      ],
      nodeHighlights: {
        "document-root": [
          { label: "Source", value: "Board memo" },
          { label: "Approved", value: "LATAM expansion budget" },
          { label: "Pending", value: "Warehouse lease decision" },
          { label: "Assigned", value: "Elena updates forecast" },
        ],
        "document-node": [
          { label: "Type", value: "Document" },
          { label: "Name", value: "Board memo" },
          { label: "Role", value: "Evidence object" },
          { label: "Used for", value: "Decisions and task extraction" },
        ],
        "document-decision-approved": [
          { label: "Type", value: "Decision" },
          { label: "Status", value: "Approved" },
          { label: "Subject", value: "LATAM expansion budget" },
          { label: "Source", value: "Board memo" },
        ],
        "document-decision-pending": [
          { label: "Type", value: "Pending decision" },
          { label: "Subject", value: "Warehouse lease" },
          { label: "Status", value: "Delayed" },
          { label: "Blocked by", value: "Legal review" },
        ],
        "document-blocker": [
          { label: "Type", value: "Risk" },
          { label: "Blocker", value: "Legal review" },
          { label: "Affects", value: "Warehouse lease decision" },
          { label: "State", value: "Pending resolution" },
        ],
        "document-task": [
          { label: "Type", value: "Task" },
          { label: "Owner", value: "Elena" },
          { label: "Action", value: "Update forecast" },
          { label: "Deadline", value: "Before next week's board packet" },
        ],
      },
      recordTree: {
        id: "document-root",
        label: "Record: Board memo extraction",
        kind: "Model record",
        summary:
          "The source memo remains intact while decisions, blockers, and assignments become linked structured memory.",
        chips: ["document-backed", "auditable", "multi-entity"],
        children: [
          {
            id: "document-node",
            label: "Source: board memo",
            kind: "Document",
            summary:
              "The memo is stored as an evidence object so every extracted fact can point back to a durable source.",
            chips: ["source of truth", "artifact"],
          },
          {
            id: "document-decision-approved",
            label: "Decision: approve LATAM budget",
            kind: "Decision",
            summary:
              "Approved outcomes are structured separately from pending or blocked items, so agents summarize accurately.",
            chips: ["approved", "decision"],
          },
          {
            id: "document-decision-pending",
            label: "Decision: warehouse lease delayed",
            kind: "Pending decision",
            summary:
              "Pending outcomes keep their blocker attached so future updates can explain why they are still unresolved.",
            chips: ["pending", "blocked"],
            children: [
              {
                id: "document-blocker",
                label: "Blocker: legal review",
                kind: "Risk",
                summary:
                  "The legal dependency is preserved as its own object, making it queryable across documents and meetings.",
                chips: ["dependency", "legal"],
              },
            ],
          },
          {
            id: "document-task",
            label: "Task: Elena updates forecast",
            kind: "Task",
            summary:
              "Assignments created by the memo can feed downstream workflows while preserving the board memo source.",
            chips: ["owner", "deliverable"],
          },
        ],
      },
      relations: [
        {
          source: "Board memo",
          sourceType: "document",
          label: "approved",
          target: "LATAM expansion budget",
          targetType: "decision",
          note: "Decision state can be surfaced independently from the full memo text.",
        },
        {
          source: "Warehouse lease decision",
          sourceType: "pending-decision",
          label: "blocked_by",
          target: "Legal review",
          targetType: "risk",
          note: "Blockers keep the pending item contextualized.",
        },
        {
          source: "Elena",
          sourceType: "person",
          label: "assigned",
          target: "Updated forecast",
          targetType: "task",
          note: "Ownership becomes reusable operational memory.",
        },
      ],
    },
  },
  "agent-community": {
    id: "agent-community",
    label: "Agent Community",
    examplePath: "agent-community",
    agent: {
      identity: [
        "You help private communities discover aligned members, explain why they should meet, and draft warm introductions.",
        "Turn connected public profiles and member-provided context into a live community graph that stays useful over time.",
      ],
      soul: [
        "- Prefer high-signal, opt-in matching over broad outreach.",
        "- Explain why two members should meet before drafting any introduction.",
        "- Never send introductions without approval.",
      ],
      user: [
        "- Team: Community operations",
        "- Priority: High-quality member introductions without manual profile research",
        "- Preference: Slack and email drafts with clear rationale",
      ],
    },
    model: {
      entities: [
        "Member",
        "Company",
        "Project",
        "Repository",
        "Post",
        "Topic",
        "Match",
      ],
      relationships: [
        {
          label: "works_at",
          note: "Keep member context tied to the company or organization they currently represent.",
        },
        {
          label: "building_project",
          note: "Track the products, startups, or initiatives members are actively working on.",
        },
        {
          label: "maintains_repo",
          note: "Link members to repositories so technical interests and recent activity stay queryable.",
        },
        {
          label: "writes_about",
          note: "Capture blog posts, newsletters, and public writing so matching includes current thinking, not just static bios.",
        },
        {
          label: "interested_in",
          note: "Store durable interests and goals that can be reused across matching and introductions.",
        },
        {
          label: "matches_with",
          note: "Represent suggested introductions with reasons and confidence so outreach history is auditable.",
        },
        {
          label: "introduced_to",
          note: "Track completed introductions so the system avoids duplicate outreach and preserves relationship history.",
        },
      ],
    },
    skills: {
      description:
        "Keep member profiles fresh, surface good matches, and draft approved introductions",
      agentId: "agent-community",
      skillId: "agent-community",
      skills: [
        "github-mcp",
        "linkedin-mcp",
        "newsletter-monitor",
        "web-profile-sync",
        "profile-import",
      ],
      nixPackages: ["playwright", "jq"],
      allowedDomains: [
        "api.github.com",
        "linkedin.com",
        ".substack.com",
      ],
      mcpServer: "web-profile-sync",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Prioritize opt-in matching and explain the reason for every suggested introduction.",
        "Draft outreach for Slack or email, but only send after approval.",
      ],
    },
    memory: {
      id: "member",
      description:
        "Build a private member graph from connected profiles, projects, posts, and stated interests so introductions get better over time.",
      sourceLabel: "Example member profile",
      sourceText:
        "Remember that Sarah Chen is the founder of Relay Labs, is building agent infrastructure for orchestration and long-term memory, maintains active GitHub repositories for eval tooling, writes a Substack about agent memory and developer workflows, and wants to meet founders and engineers working on agent infrastructure, MCP tools, and developer tooling.",
      entitySelections: {
        Member: "community-member",
        Company: "community-company",
        Project: "community-project",
        Repository: "community-repo",
        Post: "community-post",
        Topic: "community-topic",
        Match: "community-match",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the member graph",
          detail:
            "Represent members, companies, projects, repos, posts, topics, and introductions as linked objects so the community can remember who is building what and why they should meet.",
          chips: [
            "Member",
            "Project",
            "Repository",
            "Post",
            "Topic",
            "Match",
          ],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest GitHub, LinkedIn, newsletters, personal websites, and manual profile forms through MCP proxying, public feeds, and Connector SDK integrations.",
          chips: [
            "GitHub",
            "LinkedIn",
            "Substack",
            "Personal website",
            "Manual profile import",
            "Custom SDK",
          ],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let members connect their data",
          detail:
            "Use MCP login and OAuth for connected accounts, support RSS and public-site ingestion for newsletters and blogs, and allow manual profile imports without exposing credentials to agents.",
          chips: [
            "MCP login",
            "OAuth",
            "RSS feeds",
            "Manual profile form",
            "CSV import",
          ],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context everywhere",
          detail:
            "The same member graph powers community concierge agents in Slack, internal dashboards, and MCP clients like OpenClaw, ChatGPT, and Claude.",
          chips: ["Slack", "Dashboard", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "A scheduled watcher turns new launches, posts, project updates, and hiring signals into suggestions about which members might care and which warm introductions to draft next.",
        },
      ],
      watcher: {
        name: "Opportunity matcher",
        schedule: "Every 12 hours",
        prompt:
          "Monitor connected profiles, newsletters, websites, and member updates for new launches, posts, hiring signals, funding news, and project changes. Identify which members are likely to care, explain why, and queue approved intro or outreach drafts.",
        extractionSchema:
          "{ signals:[{ type, source, related_topics[], interested_members[], reason, suggested_action }] }",
        schemaEvolution:
          "Started with profile refresh and topic extraction. After repeated runs, added interested_members and suggested_action so the watcher could recommend who should see a launch, who should meet, and which outreach draft to prepare.",
      },
      highlights: [
        { label: "Member", value: "Sarah Chen" },
        { label: "Company", value: "Relay Labs" },
        { label: "Focus", value: "Agent memory, evals, orchestration" },
        {
          label: "Connected sources",
          value: "GitHub, LinkedIn, Substack, website",
        },
        {
          label: "Intro goal",
          value: "Meet founders and engineers building agent infrastructure",
        },
      ],
      nodeHighlights: {
        "community-root": [
          { label: "Member", value: "Sarah Chen" },
          { label: "Company", value: "Relay Labs" },
          { label: "Topics", value: "Agent memory, evals, orchestration" },
          { label: "Sources", value: "GitHub, LinkedIn, Substack, website" },
        ],
        "community-member": [
          { label: "Type", value: "Member" },
          { label: "Name", value: "Sarah Chen" },
          { label: "Role", value: "Founder" },
          { label: "Company", value: "Relay Labs" },
        ],
        "community-company": [
          { label: "Type", value: "Company" },
          { label: "Name", value: "Relay Labs" },
          { label: "Category", value: "Agent infrastructure" },
          { label: "Stage", value: "Early-stage startup" },
        ],
        "community-project": [
          { label: "Type", value: "Project" },
          { label: "Name", value: "Relay Labs platform" },
          { label: "Focus", value: "Orchestration and long-term memory" },
          { label: "Status", value: "Actively building" },
        ],
        "community-repo": [
          { label: "Type", value: "Repository" },
          { label: "Name", value: "eval-orchestrator" },
          { label: "Activity", value: "Recently updated" },
          { label: "Theme", value: "Agent eval tooling" },
        ],
        "community-post": [
          { label: "Type", value: "Post" },
          { label: "Title", value: "Why agent memory needs structure" },
          { label: "Source", value: "Substack" },
          { label: "Topics", value: "Agent memory, developer workflows" },
        ],
        "community-topic": [
          { label: "Type", value: "Topic" },
          { label: "Name", value: "Agent memory" },
          { label: "Evidence", value: "Newsletter + repos" },
          { label: "Why it matters", value: "High-signal matching input" },
        ],
        "community-match": [
          { label: "Type", value: "Match" },
          { label: "Suggested match", value: "Priya Natarajan" },
          {
            label: "Reason",
            value: "Shared agent infra focus, complementary MCP tooling work",
          },
          { label: "Status", value: "Draft intro pending approval" },
        ],
      },
      recordTree: {
        id: "community-root",
        label: "Record: Sarah Chen member graph",
        kind: "Model record",
        summary:
          "Member record combines connected profiles, projects, topics, and intro goals into a reusable community graph.",
        chips: ["community", "member-graph", "timelined"],
        children: [
          {
            id: "community-member",
            label: "Entity: Sarah Chen",
            kind: "Member",
            summary:
              "Primary member node stores role, company, connected sources, and who this member wants to meet.",
            chips: ["primary", "member"],
          },
          {
            id: "community-company",
            label: "Company: Relay Labs",
            kind: "Company",
            summary:
              "Company node holds current organization context so the community graph stays grounded in what the member is building now.",
            chips: ["company", "context"],
          },
          {
            id: "community-project",
            label: "Project: Relay Labs platform",
            kind: "Project",
            summary:
              "Project node captures the member's active work so matching can use current build context rather than stale bios.",
            chips: ["project", "active"],
          },
          {
            id: "community-repo",
            label: "Repository: eval-orchestrator",
            kind: "Repository",
            summary:
              "Repository activity provides concrete technical evidence for skills, interests, and recency.",
            chips: ["repo", "signal"],
          },
          {
            id: "community-post",
            label: "Post: Why agent memory needs structure",
            kind: "Post",
            summary:
              "Newsletter and blog posts reveal what a member is actively thinking about, making topic extraction and matching more current.",
            chips: ["post", "content"],
          },
          {
            id: "community-match",
            label: "Match: Priya Natarajan",
            kind: "Match",
            summary:
              "Derived match node stores why two members should meet and whether an introduction has been approved or sent.",
            chips: ["derived", "intro"],
          },
        ],
      },
      relations: [
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "works_at",
          target: "Relay Labs",
          targetType: "company",
          note: "Current company context helps explain what the member is building and who is relevant to meet.",
        },
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "building_project",
          target: "Relay Labs platform",
          targetType: "project",
          note: "Project relationships make intros grounded in current work instead of static bios.",
        },
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "maintains_repo",
          target: "eval-orchestrator",
          targetType: "repository",
          note: "Recent code activity acts as high-signal evidence for technical interests and expertise.",
        },
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "writes_about",
          target: "Why agent memory needs structure",
          targetType: "post",
          note: "Public writing reveals current thinking and makes topic extraction richer than static bios.",
        },
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "interested_in",
          target: "Agent memory",
          targetType: "topic",
          note: "Explicit interests improve matching and let intro drafts explain the overlap clearly.",
        },
        {
          source: "Sarah Chen",
          sourceType: "member",
          label: "matches_with",
          target: "Priya Natarajan",
          targetType: "member",
          note: "Match relationships preserve why an introduction was suggested and avoid duplicate outreach later.",
        },
      ],
    },
    owlettoOrg: "agent-community",
  },
  "market-intelligence": {
    id: "market-intelligence",
    label: "Market Intelligence",
    examplePath: "market-intelligence",
    agent: {
      identity: [
        "You track brands, products, and market signals across the competitive landscape.",
        "Monitor company positioning, product launches, and strategic shifts.",
      ],
      soul: [
        "- Distinguish signal from noise in market chatter.",
        "- Preserve source context for every insight.",
        "- Cross-reference mentions across brands and products.",
      ],
      user: [
        "- Team: Product strategy and competitive intelligence",
        "- Priority: Track competitive moves and customer sentiment",
        "- Preference: Weekly market scans with alert-driven updates",
      ],
    },
    model: {
      entities: ["Brand", "Product"],
      relationships: [
        {
          label: "mentions",
          note: "Track content mentions across news, reviews, and social channels to understand market presence.",
        },
      ],
    },
    skills: {
      description:
        "Monitor brands, track product launches, analyze market trends",
      agentId: "market-intel",
      skillId: "market-intel",
      skills: ["product-hunt-mcp", "crunchbase-mcp", "web-monitor"],
      nixPackages: ["playwright", "jq"],
      allowedDomains: ["producthunt.com", "crunchbase.com", ".techcrunch.com"],
      mcpServer: "web-monitor",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Flag significant product changes and pricing shifts.",
        "Track competitive responses to new feature launches.",
      ],
    },
    memory: {
      id: "brand",
      description:
        "Track brands, products, and market positioning with source-linked evidence.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that Airtable launched Airtable Interfaces, added AI features to their product suite, and was mentioned in a comparison against Notion in three recent reviews.",
      entitySelections: {
        Brand: "brand-entity",
        Product: "brand-product",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the market",
          detail:
            "Represent brands and products as first-class objects with positioning, features, and competitive relationships.",
          chips: ["Brand", "Product", "Positioning", "Features"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest from Product Hunt, review sites, news sources, and social mentions through supported connectors and MCP proxying.",
          chips: [
            "Product Hunt",
            "Review sites",
            "News feeds",
            "Social mentions",
            "Custom SDK",
          ],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Support OAuth for review platforms, RSS feeds for news, and API keys for private sources while keeping credentials scoped outside the agent runtime.",
          chips: ["OAuth", "RSS feeds", "API keys", "Manual import"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context everywhere",
          detail:
            "Market intelligence powers competitive analysis agents in Slack, strategy tools, and MCP clients like OpenClaw, ChatGPT, and Claude.",
          chips: ["Slack", "Strategy tools", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers turn new product launches, feature announcements, and market shifts into updated brand and product memory.",
        },
      ],
      watcher: {
        name: "Competitive brand tracker",
        schedule: "Every 6 hours",
        prompt:
          "Monitor Airtable for new features, pricing changes, and competitive positioning against similar tools.",
        extractionSchema:
          "{ new_features[], pricing_changes[], positioning_shifts[], competitive_mentions[] }",
        schemaEvolution:
          "Started with product_features + pricing. After tracking for a month, added integrations and target_audience fields to capture positioning evolution.",
      },
      highlights: [
        { label: "Brand", value: "Airtable" },
        { label: "New feature", value: "Airtable Interfaces" },
        { label: "Enhancement", value: "AI features added" },
        {
          label: "Competitive context",
          value: "Compared to Notion in 3 reviews",
        },
      ],
      nodeHighlights: {
        "brand-root": [
          { label: "Brand", value: "Airtable" },
          { label: "New feature", value: "Airtable Interfaces" },
          { label: "Enhancement", value: "AI features added" },
          { label: "Mentions", value: "Compared to Notion in reviews" },
        ],
        "brand-entity": [
          { label: "Type", value: "Brand" },
          { label: "Name", value: "Airtable" },
          { label: "Category", value: "Spreadsheets and Databases" },
          { label: "Recent activity", value: "New AI features" },
        ],
        "brand-product": [
          { label: "Type", value: "Product" },
          { label: "Name", value: "Airtable Interfaces" },
          { label: "Launch date", value: "Recent" },
          { label: "Brand", value: "Airtable" },
        ],
      },
      recordTree: {
        id: "brand-root",
        label: "Record: Airtable market update",
        kind: "Model record",
        summary:
          "Market scan captures product launches, feature additions, and competitive context for the brand.",
        chips: ["market-intel", "competitive", "timelined"],
        children: [
          {
            id: "brand-entity",
            label: "Entity: Airtable",
            kind: "Brand",
            summary:
              "Primary brand node accumulates product launches, positioning, and competitive intelligence.",
            chips: ["primary", "brand"],
          },
          {
            id: "brand-product",
            label: "Product: Airtable Interfaces",
            kind: "Product",
            summary:
              "New product launch is tracked as its own entity with feature set and market positioning.",
            chips: ["product", "launch"],
          },
        ],
      },
      relations: [
        {
          source: "Reviews",
          sourceType: "content",
          label: "mentions",
          target: "Airtable vs Notion",
          targetType: "comparison",
          note: "Competitive mentions are preserved with source context.",
        },
      ],
    },
    owlettoOrg: "market-intelligence",
  },
  careops: {
    id: "careops",
    label: "Healthcare",
    examplePath: "careops",
    agent: {
      identity: [
        "You help healthcare practices manage patient care, appointments, and treatment workflows.",
        "Track therapist assignments, treatment plans, and operational coordination.",
      ],
      soul: [
        "- Protect patient privacy and confidentiality.",
        "- Preserve treatment history and provider assignments.",
        "- Flag scheduling conflicts and care gaps immediately.",
      ],
      user: [
        "- Team: Clinical operations and practice management",
        "- Priority: Coordinate care and track patient progress",
        "- Preference: Clear therapist availability and patient status",
      ],
    },
    model: {
      entities: ["Patient", "Appointment", "Treatment", "Therapist", "Vendor"],
      relationships: [
        {
          label: "assigned_to",
          note: "Track which therapist is responsible for each patient and their care coordination.",
        },
        {
          label: "has_appointment",
          note: "Link scheduled appointments to patients and treatment plans.",
        },
        {
          label: "on_treatment",
          note: "Connect patients to their active treatment plans and care protocols.",
        },
        {
          label: "treats",
          note: "Track therapist-patient relationships and care assignments.",
        },
        {
          label: "covered_by",
          note: "Link patients and treatments to insurance vendors for billing.",
        },
      ],
    },
    skills: {
      description:
        "Schedule appointments, track treatment progress, coordinate care",
      agentId: "careops",
      skillId: "careops",
      skills: ["calendar-mcp", "ehr-mcp", "insurance-portal"],
      nixPackages: ["ripgrep", "jq"],
      allowedDomains: [".ehr.com", ".insurance-portal.com"],
      mcpServer: "calendar-mcp",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Confirm patient identity and authorization before discussing care details.",
        "Flag appointments that need rescheduling or therapist follow-up.",
      ],
    },
    memory: {
      id: "patient",
      description:
        "Coordinate patient care, track treatment progress, and manage therapist assignments.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that James McManus is assigned to therapist Nicole Musto for OCD treatment, has an appointment next Tuesday at 2 PM, and his treatment plan includes weekly exposure therapy sessions covered by Blue Cross Blue Shield.",
      entitySelections: {
        Patient: "patient-entity",
        Appointment: "patient-appointment",
        Treatment: "patient-treatment",
        Therapist: "patient-therapist",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model patient care",
          detail:
            "Represent patients, appointments, treatments, and therapists as linked entities that capture the full care context.",
          chips: ["Patient", "Appointment", "Treatment", "Therapist"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest from EHR systems, calendar feeds, patient portals, and email threads through supported connectors and MCP proxying.",
          chips: ["EHR", "Calendars", "Patient portal", "Email", "Custom SDK"],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Support OAuth for EHR and calendar systems, API keys for practice management tools, and HIPAA-compliant imports for patient data.",
          chips: ["OAuth", "EHR integration", "API keys", "Secure import"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context everywhere",
          detail:
            "Patient care context powers coordination agents in practice portals, messaging apps, and MCP clients like OpenClaw, ChatGPT, and Claude.",
          chips: [
            "Practice portals",
            "Messaging",
            "OpenClaw",
            "ChatGPT",
            "Claude",
          ],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers turn new appointments, treatment plan updates, and therapist assignments into current patient memory.",
        },
      ],
      watcher: {
        name: "Patient care tracker",
        schedule: "Every morning at 7 AM",
        prompt:
          "Check James McManus for appointment changes, treatment progress, and insurance coverage status.",
        extractionSchema:
          "{ next_appointment, treatment_status, therapist_notes[], insurance_status, upcoming_actions[] }",
        schemaEvolution:
          "Started with appointment + therapist. After two months, added treatment_milestones and insurance_renewal_date to capture care progression.",
      },
      highlights: [
        { label: "Patient", value: "James McManus" },
        { label: "Therapist", value: "Nicole Musto" },
        { label: "Next appointment", value: "Tuesday at 2 PM" },
        { label: "Treatment", value: "Weekly exposure therapy" },
        { label: "Insurance", value: "Blue Cross Blue Shield" },
      ],
      nodeHighlights: {
        "patient-root": [
          { label: "Patient", value: "James McManus" },
          { label: "Therapist", value: "Nicole Musto" },
          { label: "Next appointment", value: "Tuesday at 2 PM" },
          { label: "Insurance", value: "Blue Cross Blue Shield" },
        ],
        "patient-entity": [
          { label: "Type", value: "Patient" },
          { label: "Name", value: "James McManus" },
          { label: "Status", value: "Active treatment" },
          { label: "Therapist", value: "Nicole Musto" },
        ],
        "patient-appointment": [
          { label: "Type", value: "Appointment" },
          { label: "When", value: "Tuesday at 2 PM" },
          { label: "Type", value: "Weekly session" },
          { label: "Patient", value: "James McManus" },
        ],
        "patient-treatment": [
          { label: "Type", value: "Treatment" },
          { label: "Plan", value: "Exposure therapy for OCD" },
          { label: "Frequency", value: "Weekly sessions" },
          { label: "Duration", value: "Ongoing" },
        ],
        "patient-therapist": [
          { label: "Type", value: "Therapist" },
          { label: "Name", value: "Nicole Musto" },
          { label: "Credentials", value: "MS, LPC" },
          { label: "Patient", value: "James McManus" },
        ],
      },
      recordTree: {
        id: "patient-root",
        label: "Record: James McManus care update",
        kind: "Model record",
        summary:
          "Patient care becomes a hierarchy of appointments, treatment plans, therapist assignments, and insurance context.",
        chips: ["patient-care", "hipaa-aware", "actionable"],
        children: [
          {
            id: "patient-entity",
            label: "Entity: James McManus",
            kind: "Patient",
            summary:
              "Primary patient node holds treatment status, therapist assignment, and care coordination context.",
            chips: ["primary", "patient"],
          },
          {
            id: "patient-appointment",
            label: "Appointment: Tuesday session",
            kind: "Appointment",
            summary:
              "Scheduled appointments are tracked with treatment context and preparation notes.",
            chips: ["scheduled", "recurring"],
          },
          {
            id: "patient-treatment",
            label: "Treatment: Exposure therapy plan",
            kind: "Treatment",
            summary:
              "Active treatment plan captures therapy type, frequency, and progress milestones.",
            chips: ["active", "evidence-based"],
          },
        ],
      },
      relations: [
        {
          source: "James McManus",
          sourceType: "patient",
          label: "treats",
          target: "Nicole Musto",
          targetType: "therapist",
          note: "Therapist assignment becomes durable care relationship context.",
        },
        {
          source: "James McManus",
          sourceType: "patient",
          label: "has_appointment",
          target: "Tuesday at 2 PM",
          targetType: "appointment",
          note: "Scheduled appointments are linked to patient and treatment plans.",
        },
        {
          source: "James McManus treatment",
          sourceType: "treatment",
          label: "covered_by",
          target: "Blue Cross Blue Shield",
          targetType: "insurance",
          note: "Insurance coverage is tracked for billing and care authorization.",
        },
      ],
    },
    owlettoOrg: "careops",
  },
  "venture-capital": {
    id: "venture-capital",
    label: "Venture Capital",
    examplePath: "venture-capital",
    agent: {
      identity: [
        "You help VC firms track companies, founders, and investment opportunities.",
        "Monitor portfolio companies, sourcing pipeline, and market signals.",
      ],
      soul: [
        "- Distinguish signal from noise in deal flow.",
        "- Preserve investment memos and decision context.",
        "- Track competitive dynamics and market shifts.",
      ],
      user: [
        "- Team: Investment partners and sourcing team",
        "- Priority: Track portfolio health and new opportunities",
        "- Preference: Company summaries with clear investment signals",
      ],
    },
    model: {
      entities: ["Company", "Founder", "Investor", "Fund Round", "Sector"],
      relationships: [
        {
          label: "founded_by",
          note: "Track founding teams and their backgrounds for pattern recognition.",
        },
        {
          label: "invested_in",
          note: "Keep investment history and portfolio connections visible.",
        },
        {
          label: "works_at",
          note: "Track founder and executive movements across companies.",
        },
        {
          label: "in_sector",
          note: "Connect companies to investment sectors and thesis areas.",
        },
        {
          label: "round_of",
          note: "Link funding rounds to companies and lead investors.",
        },
        {
          label: "sourced_by",
          note: "Track deal sourcing and network connections.",
        },
      ],
    },
    skills: {
      description:
        "Track companies, monitor deal flow, analyze portfolio metrics",
      agentId: "vc-tracking",
      skillId: "vc-tracking",
      skills: ["crunchbase-mcp", "linkedin-mcp", "news-monitor"],
      nixPackages: ["playwright", "jq"],
      allowedDomains: ["crunchbase.com", "linkedin.com", ".techcrunch.com"],
      mcpServer: "news-monitor",
      providerId: "anthropic",
      model: "claude/sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      skillInstructions: [
        "Flag significant funding rounds and executive changes.",
        "Track portfolio company expansion into new markets.",
      ],
    },
    memory: {
      id: "company",
      description:
        "Track companies, founders, funding rounds, and investment signals with full context.",
      sourceLabel: "Example prompt",
      sourceText:
        "Remember that Lovable raised a $653M Series B at a $6.6B valuation, was founded by Anton Osika and Fabian Hedin, operates in the AI Developer Tools sector, and their round was led by a16z.",
      entitySelections: {
        Company: "company-entity",
        Founder: "company-founder",
        "Fund Round": "company-round",
        Sector: "company-sector",
        Investor: "company-investor",
      },
      howItWorks: [
        {
          id: "model",
          label: "1",
          title: "Model the venture landscape",
          detail:
            "Represent companies, founders, investors, and funding rounds as linked entities for deal tracking and pattern recognition.",
          chips: ["Company", "Founder", "Investor", "Fund Round", "Sector"],
        },
        {
          id: "connect",
          label: "2",
          title: "Connect sources",
          detail:
            "Ingest from Crunchbase, LinkedIn, news sources, and internal deal memos through supported connectors and MCP proxying.",
          chips: [
            "Crunchbase",
            "LinkedIn",
            "News feeds",
            "Deal memos",
            "Custom SDK",
          ],
          links: [technicalLinks.mcpProxy, technicalLinks.connectorSdk],
        },
        {
          id: "auth",
          label: "3",
          title: "Let users connect their data",
          detail:
            "Support OAuth for data providers, API keys for premium sources, and manual imports for proprietary deal information.",
          chips: ["OAuth", "API keys", "CSV import", "Manual entry"],
          links: [technicalLinks.memoryDocs, technicalLinks.mcpAuthFlow],
        },
        {
          id: "reuse",
          label: "4",
          title: "Reuse context everywhere",
          detail:
            "Investment intelligence powers deal review agents in internal tools, messaging apps, and MCP clients like OpenClaw, ChatGPT, and Claude.",
          chips: ["Deal tools", "Slack", "OpenClaw", "ChatGPT", "Claude"],
        },
        {
          id: "fresh",
          label: "5",
          title: "Keep it fresh",
          detail:
            "Watchers turn new funding rounds, portfolio updates, and market signals into current company memory.",
        },
      ],
      watcher: {
        name: "Portfolio company monitor",
        schedule: "Every 12 hours",
        prompt:
          "Check Lovable for new funding, product launches, team growth, and competitive positioning changes.",
        extractionSchema:
          "{ new_funding[], product_launches[], headcount_change, competitive_moves[], market_expansion[] }",
        schemaEvolution:
          "Started with funding + team_size. After tracking for 3 months, added product_milestones and enterprise_customers to capture growth signals.",
      },
      highlights: [
        { label: "Company", value: "Lovable" },
        { label: "Series B", value: "$653M raised" },
        { label: "Valuation", value: "$6.6B" },
        { label: "Founders", value: "Anton Osika, Fabian Hedin" },
        { label: "Sector", value: "AI Developer Tools" },
        { label: "Lead investor", value: "a16z" },
      ],
      nodeHighlights: {
        "company-root": [
          { label: "Company", value: "Lovable" },
          { label: "Funding", value: "Series B: $653M" },
          { label: "Valuation", value: "$6.6B" },
          { label: "Founders", value: "Anton Osika, Fabian Hedin" },
          { label: "Sector", value: "AI Developer Tools" },
        ],
        "company-entity": [
          { label: "Type", value: "Company" },
          { label: "Name", value: "Lovable" },
          { label: "Stage", value: "Series B" },
          { label: "Valuation", value: "$6.6B" },
          { label: "Sector", value: "AI Developer Tools" },
        ],
        "company-founder": [
          { label: "Type", value: "Founder" },
          { label: "Name", value: "Anton Osika" },
          { label: "Role", value: "CEO & Co-Founder" },
          { label: "Company", value: "Lovable" },
        ],
        "company-round": [
          { label: "Type", value: "Fund Round" },
          { label: "Stage", value: "Series B" },
          { label: "Amount", value: "$653M" },
          { label: "Lead", value: "a16z" },
          { label: "Company", value: "Lovable" },
        ],
        "company-sector": [
          { label: "Sector", value: "AI Developer Tools" },
          { label: "Practice area", value: "AI infrastructure" },
          { label: "Companies", value: "Lovable, Bolt, others" },
        ],
        "company-investor": [
          { label: "Type", value: "Investor" },
          { label: "Name", value: "a16z" },
          { label: "Role", value: "Lead investor" },
          { label: "Company", value: "Lovable" },
        ],
      },
      recordTree: {
        id: "company-root",
        label: "Record: Lovable company update",
        kind: "Model record",
        summary:
          "Company record accumulates funding history, founder information, sector placement, and investor relationships.",
        chips: ["portfolio", "timelined", "comprehensive"],
        children: [
          {
            id: "company-entity",
            label: "Entity: Lovable",
            kind: "Company",
            summary:
              "Primary company node holds stage, valuation, and market position context.",
            chips: ["primary", "company"],
          },
          {
            id: "company-founder",
            label: "Founder: Anton Osika",
            kind: "Founder",
            summary:
              "Founders are tracked with role, background, and other portfolio companies they've founded.",
            chips: ["founder", "team"],
          },
          {
            id: "company-round",
            label: "Fund Round: Series B",
            kind: "Fund Round",
            summary:
              "Funding rounds capture amount, lead investor, and competitive context.",
            chips: ["funding", "growth"],
          },
        ],
      },
      relations: [
        {
          source: "Anton Osika",
          sourceType: "founder",
          label: "founded_by",
          target: "Lovable",
          targetType: "company",
          note: "Founder relationships support pattern recognition across successful founders.",
        },
        {
          source: "Lovable",
          sourceType: "company",
          label: "invested_in",
          target: "a16z",
          targetType: "investor",
          note: "Investment relationships track portfolio companies and syndicate partners.",
        },
        {
          source: "Lovable",
          sourceType: "company",
          label: "in_sector",
          target: "AI Developer Tools",
          targetType: "sector",
          note: "Sector placement enables thesis tracking and competitive landscape analysis.",
        },
      ],
    },
    owlettoOrg: "venture-capital",
  },
} satisfies Record<string, LandingUseCaseDefinition>;

export type LandingUseCaseId = keyof typeof landingUseCases;
