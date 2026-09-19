# Configure CampaignForge in TrueForge

## 1. Start the local MCP service

Copy `.env.example` to `.env`, set a long `CAMPAIGNFORGE_API_KEY`, and leave `PUBLISHING_ENABLED=false`. Start the service with `npm run dev`.

The service binds to `127.0.0.1:8788` by default. It exposes:

- `GET /health`
- Streamable HTTP MCP at `POST /mcp`

## 2. Configure provider credentials

- In **TrueForge → Settings → Models**, configure OpenAI.
- Put `OPENAI_API_KEY` in the CampaignForge MCP `.env` for static-image generation. This key is separate from the OpenAI model-provider connection in TrueForge.
- Put `FIRECRAWL_API_KEY` in `.env` only if optional brand-URL research is desired.
- Configure OAuth/access tokens and non-production test account IDs for LinkedIn, Meta (Facebook + Instagram), and TikTok in `.env`.

Never place these credentials in a TrueForge skill or a user prompt.

## 3. Register the MCP connector

In **TrueForge → Settings → Connectors → Add MCP Server**:

- URL: `http://127.0.0.1:8788/mcp`
- Authentication: header auth
- Header: `x-api-key: <CAMPAIGNFORGE_API_KEY>`

For a hosted TrueForge deployment, expose the MCP service over HTTPS and use its public URL. Do not expose this local development server to the internet.

## 4. Register the skills

In **TrueForge → Settings → Skills**, import this repository and enable:

- `campaign-brief`
- `campaign-strategy`
- `campaign-creative`
- `platform-copy`
- `campaign-evaluation`

Skills need an enabled sandbox in TrueForge because they are materialized from Git at runtime.

## 5. Create the Campaign Orchestrator agent

Create one agent named `Campaign Orchestrator`.

- Attach the OpenAI model, CampaignForge MCP connector, and all five skills.
- Enable subagents and context compaction.
- In its instructions, state: use the skills in order; do not generate images until one concept is explicitly selected; use `campaign-creative` to write a complete advertising brief before every `generate_image` call; do not publish before final package approval; request approval for each `publish_post` tool call.
- Configure `publish_post` as an approval-required/destructive tool in your TrueForge deployment. This is mandatory before enabling publishing.

Suggested test prompt: use the structured brief in `fixtures/launch-brief.json`, replacing its sample asset URL with a real public image URL before media generation.

## 6. Enable a test publish only when ready

Before setting `PUBLISHING_ENABLED=true`:

1. Validate each payload using `validate_platform_payload`.
2. Generate `create_post_draft` output and have a person inspect it.
3. Verify all providers are pointed to designated test accounts.
4. Confirm TrueForge approval is active for `publish_post`.

Publishing occurs immediately. CampaignForge v1 intentionally does not schedule posts or retry a failed publication automatically. It generates static images only; add a dedicated photo-post adapter before attempting TikTok live publishing.
