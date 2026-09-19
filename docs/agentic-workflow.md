# CampaignForge agentic workflow

CampaignForge uses a gated three-role workflow. The MCP service enforces the critical transition, so a prompt alone cannot bypass concept approval.

```text
Orchestrator
  -> assess_campaign_intake
  -> Planner: create_campaign_plan
  -> Human: select + approve concept
  -> approve_campaign_concept
  -> Executor: generate_image(planId, production brief)
  -> inline PNG in TrueForge chat
```

## Intake questions

The planner asks only for facts that change the output: product/offer, campaign objective, audience, placement/platform, and CTA. It optionally collects brand assets, brand constraints, mandatory legal copy, exact in-image copy, and visual direction. It must not ask a menu question such as “prompt or image?”

The user-facing orchestrator collects these details conversationally through the normal chat composer. It returns a standard Markdown message that lists only missing fields and provides a short plain-text reply template. It can offer known options inline and accepts natural-language answers. For platforms, it accepts a comma-separated list such as `LinkedIn, Instagram, TikTok`, normalizes the values, and re-runs the intake gate. It does not use TrueForge question widgets, forms, buttons, or generative UI.

## Visible conversation

The chat surface contains campaign content only: intake questions, three creative directions, approval requests, and the delivered image. It never exposes internal plan IDs, agent roles, skills, tools, or status tables. TrueForge's built-in collapsible Agent steps remains the observability surface for tool calls and execution details.

CampaignForge executes constrained planner and executor roles inside one saved, user-facing orchestrator agent. Those roles are an implementation detail, not copy shown to the campaign user.

## Approval model

`create_campaign_plan` creates three concept ids: `product-hero`, `audience-moment`, and `benefit-proof`. `generate_image` requires a plan id unlocked by `approve_campaign_concept`. A missing, unselected, or unapproved plan returns a server-side error and does not call OpenAI.

## TrueForge setup

Create three agents using the prompt files under `agents/`:

| Agent | Tools |
| --- | --- |
| `campaignforge-orchestrator` | `assess_campaign_intake`, `create_campaign_plan`, `approve_campaign_concept`, `generate_image` |
| `campaignforge-planner` | `assess_campaign_intake`, `create_campaign_plan`, `approve_campaign_concept` |
| `campaignforge-executor` | `generate_image` |

Use the orchestrator as the user-facing agent. The planner and executor are constrained role configurations for separate reviews or future agent-to-agent delegation. Disable sandbox, file downloads, dynamic subagents, and generative UI for all three. The orchestrator's intake is chat-first; preload the listed tools.

The prompts follow OpenAI’s guidance: make tool descriptions explicit and validate state server-side; for image production specify intended use, subject, composition, style, and constraints, while keeping model settings separate from the prompt.
