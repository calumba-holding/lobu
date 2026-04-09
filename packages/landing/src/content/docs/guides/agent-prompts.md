---
title: Agent Prompts
description: How to customize agent behavior with IDENTITY.md, SOUL.md, and USER.md.
---

Every agent has three prompt files in its directory (e.g., `agents/my-agent/`). These files shape who the agent is, how it behaves, and what it knows about the user.

## File overview

| File | Purpose | Analogy |
|------|---------|---------|
| `IDENTITY.md` | Who the agent is — name, role, personality | A job title and bio |
| `SOUL.md` | How the agent behaves — instructions, rules, constraints | A playbook |
| `USER.md` | Context about the user or environment | A briefing doc |

All three are loaded into the agent's system prompt at runtime. You can edit them freely — changes take effect on the next message (no restart needed in Docker mode after `make clean-workers`).

## IDENTITY.md

Defines the agent's identity. Keep it short — one or two sentences.

```markdown
You are Aria, a customer support agent for Acme Corp. You specialize in
billing questions, account management, and product troubleshooting.
```

A more minimal identity:

```markdown
You are a helpful AI assistant.
```

## SOUL.md

Instructions that govern the agent's behavior. This is where you put rules, constraints, tone guidelines, and workflow steps.

```markdown
# Instructions

## Tone
- Be concise and professional
- Never use emojis unless the user does first
- Ask clarifying questions when the request is ambiguous

## Workflow
1. Greet the user by name if known
2. Understand their issue before suggesting solutions
3. Always confirm before taking actions (cancellations, refunds, etc.)

## Constraints
- Never share internal pricing or discount codes
- Escalate to a human if the user asks for a manager
- Do not make up information — say "I don't know" when unsure
```

Tips:
- Use markdown headers and lists for structure
- Be specific — "be helpful" is vague, "ask one clarifying question before answering" is actionable
- Test different instructions with [evals](/guides/evals/) to measure their impact

## USER.md

Context about the user or deployment environment. This is injected into every conversation so the agent has background knowledge without the user repeating it.

```markdown
# User Context

- Timezone: US/Pacific
- Company: Acme Corp
- Plan: Enterprise
- Preferred language: English
```

This file is optional and can be left empty. It's most useful when the agent serves a specific team or user.

## Agent-specific skills

You can also place skill files in `agents/{name}/skills/`. These are agent-scoped skills only available to that agent. Shared skills that all agents can use go in the root `skills/` directory.

## Directory structure

```
agents/
  my-agent/
    IDENTITY.md     # Who
    SOUL.md         # How
    USER.md         # Context
    skills/         # Agent-specific skills
    evals/          # Agent evaluations
skills/             # Shared skills (all agents)
```

## Multi-agent example

With multiple agents in `lobu.toml`, each gets its own directory and prompt files:

```toml
[agents.support]
name = "support"
dir = "./agents/support"

[agents.sales]
name = "sales"
dir = "./agents/sales"
```

```
agents/
  support/
    IDENTITY.md   # "You are a support agent..."
    SOUL.md       # Support-specific instructions
    USER.md
  sales/
    IDENTITY.md   # "You are a sales assistant..."
    SOUL.md       # Sales-specific instructions
    USER.md
```
