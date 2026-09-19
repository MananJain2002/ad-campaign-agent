---
name: campaign-creative
description: Produce static-image prompts and inline campaign images through CampaignForge's OpenAI image tool, with cost-aware retries.
---

# Campaign Creative Production

Use a selected strategy concept when one exists. For a direct image request, generate from the user's request without requiring a separate planning turn.

1. For a direct ad-image request, translate the request into one static-image prompt and generate it in the same turn. Make sensible creative defaults for non-essential details; never ask whether the user wants a prompt, a brief, or an image. Ask one concise question only if a must-preserve fact—such as an exact logo, product photo, legal copy, or destination format—is absent and would materially change the result. Preserve any user-owned brand assets; do not claim generated work is a logo.
2. Read `references/ad-image-prompt-template.md` before writing each prompt. Include the campaign goal, target audience, focal subject, setting, composition, aspect ratio, visual style, lighting, palette, brand constraints, and either exact in-image copy or an explicit instruction to leave copy out. Never invent brand claims, logos, or text.
3. Call `generate_image` once per static variant. After it succeeds, copy the returned `inlineMarkdown` exactly onto its own line in the final reply; that URL renders the PNG in chat. Do not create an SVG, sandbox-local file, fake download link, or a separate visual artifact to represent it. Upload the approved result to durable asset storage only before adding it to a publish payload.
4. Use `low` quality for early concept iterations. Use `medium` or `high` only after the user approves the direction.
5. On an image failure, explain the cause, offer one prompt adjustment, and retry only after user agreement if the failure could increase cost.

Return an asset manifest with public URLs only after the generated image has been uploaded to approved storage. Do not publish or create final social posts in this skill.
