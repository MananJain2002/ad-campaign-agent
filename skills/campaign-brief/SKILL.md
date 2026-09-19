---
name: campaign-brief
description: Turn a guided CampaignForge chat intake into a complete, structured campaign brief and identify any missing decision-critical inputs.
---

# Campaign Brief

Use this skill at the beginning of every CampaignForge run.

1. Gather campaign name, product, audience, objective, tone, CTA, selected platforms, and public brand/reference asset URLs.
2. Ask only for information that is required to make a campaign decision. Do not invent product claims, audience facts, or asset ownership.
3. If the user supplied a `researchUrl`, call `research_brand_url` and label every derived statement with its source URL. Research is optional, never a substitute for the user's approved brief.
4. Call `validate_campaign_brief` before handing the brief to strategy.
5. Return the validated brief in a compact section titled `Approved campaign brief`. Explicitly distinguish user facts, sourced research, and assumptions.

Never request credentials, access tokens, or social-account IDs in chat. Connector credentials belong only in TrueForge Settings.
