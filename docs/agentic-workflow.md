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

When an answer has a known set of choices, the user-facing orchestrator renders an interactive TrueForge form:

- Single-choice questions, such as campaign goal or visual direction, use radio controls.
- Multi-choice questions, such as target platforms, use checkboxes.
- Free-form facts, such as audience and CTA, use text fields.

Submitting the form sends its selections back to the orchestrator, which normalizes the checked platform values and re-runs the intake gate.

## Approval model

`create_campaign_plan` creates three concept ids: `product-hero`, `audience-moment`, and `benefit-proof`. `generate_image` requires a plan id unlocked by `approve_campaign_concept`. A missing, unselected, or unapproved plan returns a server-side error and does not call OpenAI.

## TrueForge setup

Create three agents using the prompt files under `agents/`:

| Agent | Tools |
| --- | --- |
| `campaignforge-orchestrator` | `assess_campaign_intake`, `create_campaign_plan`, `approve_campaign_concept`, `generate_image` |
| `campaignforge-planner` | `assess_campaign_intake`, `create_campaign_plan`, `approve_campaign_concept` |
| `campaignforge-executor` | `generate_image` |

Use the orchestrator as the user-facing agent. The planner and executor are constrained role configurations for separate reviews or future agent-to-agent delegation. Disable sandbox, file downloads, and dynamic subagents for all three. Keep TrueForge Generative UI enabled for the orchestrator so its intake form can render; preload the listed tools.

The prompts follow OpenAI’s guidance: make tool descriptions explicit and validate state server-side; for image production specify intended use, subject, composition, style, and constraints, while keeping model settings separate from the prompt.
