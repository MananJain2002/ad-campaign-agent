# CampaignForge agentic workflow

CampaignForge uses a gated parent-and-sub-agent workflow. The MCP service enforces the critical transition, so a prompt alone cannot bypass concept approval.

```text
CampaignForge (user-facing orchestrator)
  -> assess_campaign_intake
  -> CampaignForge Planner (private concept recommendation)
  -> create_campaign_plan
  -> Human: select + approve concept
  -> approve_campaign_concept
  -> CampaignForge Executor (private production brief)
  -> generate_image(planId, production brief)
  -> inline PNG in TrueForge chat
```

## Intake questions

The planner asks only for facts that change the output: product/offer, campaign objective, audience, placement/platform, and CTA. It optionally collects brand assets, brand constraints, mandatory legal copy, exact in-image copy, and visual direction. It must not ask a menu question such as “prompt or image?”

The user-facing orchestrator collects these details conversationally through the normal chat composer. It returns a standard Markdown message that lists only missing fields and provides a short plain-text reply template. It can offer known options inline and accepts natural-language answers. For platforms, it accepts a comma-separated list such as `LinkedIn, Instagram, TikTok`, normalizes the values, and re-runs the intake gate. It does not use TrueForge question widgets, forms, buttons, or generative UI.

## Visible conversation

The chat surface contains campaign content only: intake questions, three creative directions, approval requests, and the delivered image. It never exposes internal plan IDs, agent roles, skills, tools, or status tables. TrueForge's built-in collapsible Agent steps remains the observability surface for tool calls and execution details.

CampaignForge is the saved user-facing parent agent. It creates named dynamic child threads—`CampaignForge Planner` and `CampaignForge Executor`—for bounded planning and execution work. The parent sends each child a self-contained task, reviews its result, and retains responsibility for all state-changing tools. The children appear in TrueForge Agent steps, not in campaign chat.

## Approval model

`create_campaign_plan` creates three concept ids: `product-hero`, `audience-moment`, and `benefit-proof`. `generate_image` requires a plan id unlocked by `approve_campaign_concept`. A missing, unselected, or unapproved plan returns a server-side error and does not call OpenAI.

## TrueForge setup

Create three agents using the prompt files under `agents/`:

| Agent | Tools |
| --- | --- |
| `campaignforge` | `assess_campaign_intake`, `create_campaign_plan`, `approve_campaign_concept`, `generate_image` |
| `CampaignForge Planner` | Dynamic child thread — receives the normalized brief and returns concept recommendations. |
| `CampaignForge Executor` | Dynamic child thread — receives the approved concept and returns a production-ready image brief. |

Use `campaignforge` as the user-facing agent. Enable dynamic sub-agents only for it. The Planner and Executor are created per task as constrained child threads, with self-contained role prompts supplied by the parent. The parent intake is chat-first.

The prompts follow OpenAI’s guidance: make tool descriptions explicit and validate state server-side; for image production specify intended use, subject, composition, style, and constraints, while keeping model settings separate from the prompt.
