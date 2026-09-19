import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateOpenAIImage } from "./openai-image.js";
import { researchUrl } from "./research.js";
import { createPostDraft, getPostStatus, publishPost, validatePlatformPayload } from "./social.js";
import { campaignBriefSchema, platformSchema, postPayloadSchema } from "./types.js";

const postPayloadInput = z.object({
  platform: platformSchema,
  copy: z.string().min(1).max(2200),
  assets: z.array(z.object({ url: z.string().url(), kind: z.enum(["image", "video"]), altText: z.string().min(1).max(500).optional() })).max(10),
  destinationAccount: z.string().min(1),
  callToAction: z.string().max(120).optional(),
});

export function createCampaignForgeServer(): McpServer {
  const server = new McpServer(
    { name: "campaignforge-mcp", version: "0.1.0" },
    { instructions: "CampaignForge tools create and validate advertising assets. Never call publish_post without a fresh, explicit human approval for the exact returned draft payload." },
  );

  server.registerTool("validate_campaign_brief", {
    title: "Validate campaign brief",
    description: "Validates and normalizes a CampaignForge campaign brief before strategy work starts.",
    inputSchema: campaignBriefSchema,
  }, async input => ({ content: [{ type: "text", text: JSON.stringify({ valid: true, brief: input }, null, 2) }] }));

  server.registerTool("research_brand_url", {
    title: "Research a supplied brand URL",
    description: "Optionally extracts first-party context from a user-supplied website using Firecrawl. Cite this URL in any strategy claim derived from it.",
    inputSchema: { url: z.string().url() },
  }, async ({ url }) => researchUrl(url));

  server.registerTool("generate_image", {
    title: "Generate campaign image",
    description: "Creates one static campaign image with OpenAI's Images API and returns `inlineMarkdown` pointing at the generated PNG. For a normal ad-image request, make reasonable creative assumptions and call this tool immediately; do not ask whether to write a prompt versus generate an image, and do not require a separate concept-approval step. After a successful call, copy `inlineMarkdown` exactly onto its own line in the final reply so it renders in the chat. Never create or link to SVGs, sandbox files, or download-only assets. Ask one concise follow-up only when a missing must-preserve fact (for example, an exact logo, a product photo, mandatory legal copy, or a required destination format) would materially change the result. The prompt must state the campaign goal, audience, focal subject, composition, visual style, lighting, palette, and either exact in-image text with placement or an explicit no-text instruction.",
    inputSchema: {
      prompt: z.string().min(10).max(4000),
      size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
      quality: z.enum(["low", "medium", "high"]).optional(),
    },
  }, async input => generateOpenAIImage(input));

  server.registerTool("validate_platform_payload", {
    title: "Validate a platform post",
    description: "Checks destination account, credentials, asset requirements, and basic platform constraints. Validation never publishes.",
    inputSchema: postPayloadInput,
  }, async input => validatePlatformPayload(input));

  server.registerTool("create_post_draft", {
    title: "Create an export-ready post draft",
    description: "Returns a stable draft manifest for user review. It never reaches a social network.",
    inputSchema: postPayloadInput,
  }, async input => createPostDraft(input));

  server.registerTool("publish_post", {
    title: "Publish one approved post",
    description: "SIDE EFFECT: publishes exactly one post now. Configure this tool as approval-required in TrueForge. Call only after the user has explicitly approved this exact platform, destination, copy, and media.",
    inputSchema: postPayloadInput,
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async input => publishPost(input));

  server.registerTool("get_post_status", {
    title: "Get published post status",
    description: "Retrieves status for a platform post or TikTok publish job; does not modify anything.",
    inputSchema: { platform: platformSchema, postId: z.string().min(1).max(300) },
  }, async ({ platform, postId }) => getPostStatus(platform, postId));

  return server;
}
