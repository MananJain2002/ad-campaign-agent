import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateOpenAIImage } from "./openai-image.js";
import { approveCampaignConcept, assessCampaignIntake, campaignIntakeInputSchema, createCampaignPlan, getCampaignWorkflowStatus, recordImageGeneration, requireApprovedPlan } from "./campaign-plans.js";
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

  server.registerTool("assess_campaign_intake", {
    title: "Assess campaign intake",
    description: "Planning gate. Identifies the exact campaign details still needed before planning. Call this before creating a campaign plan. It never generates media or publishes.",
    inputSchema: campaignIntakeInputSchema,
  }, async input => ({ content: [{ type: "text", text: JSON.stringify(assessCampaignIntake(input), null, 2) }] }));

  server.registerTool("create_campaign_plan", {
    title: "Create campaign plan",
    description: "Planner-only tool. Creates three distinct campaign concepts after intake is complete. It never generates media. The user must select and explicitly approve one returned concept before execution.",
    inputSchema: campaignIntakeInputSchema,
  }, async input => ({ content: [{ type: "text", text: JSON.stringify(createCampaignPlan(input), null, 2) }] }));

  server.registerTool("approve_campaign_concept", {
    title: "Approve selected campaign concept",
    description: "Human approval gate. Unlocks image generation only when the user has explicitly approved the selected concept from this campaign plan.",
    inputSchema: {
      planId: z.string().uuid(),
      conceptId: z.enum(["product-hero", "audience-moment", "benefit-proof"]),
      approved: z.boolean(),
    },
  }, async input => ({ content: [{ type: "text", text: JSON.stringify(approveCampaignConcept(input), null, 2) }] }));

  server.registerTool("get_campaign_workflow_status", {
    title: "Get CampaignForge workflow status",
    description: "Returns a UI-ready, safe activity snapshot: active role, phase, completed and next tools, project guides, and concise decision summaries. It never returns private chain-of-thought. Call it before presenting a workflow activity panel.",
    inputSchema: { planId: z.string().uuid().optional() },
  }, async input => ({ content: [{ type: "text", text: JSON.stringify(getCampaignWorkflowStatus(input.planId), null, 2) }] }));

  server.registerTool("research_brand_url", {
    title: "Research a supplied brand URL",
    description: "Optionally extracts first-party context from a user-supplied website using Firecrawl. Cite this URL in any strategy claim derived from it.",
    inputSchema: { url: z.string().url() },
  }, async ({ url }) => researchUrl(url));

  server.registerTool("generate_image", {
    title: "Generate campaign image",
    description: "Executor-only tool. Creates one static campaign image with OpenAI's Images API only after an approved campaign plan. Returns `inlineMarkdown` pointing at the generated PNG; copy it exactly onto its own line in the final reply so it renders in chat. Never create or link to SVGs, sandbox files, or download-only assets. The prompt must state campaign goal, audience, focal subject, composition, visual style, lighting, palette, and either exact in-image text with placement or an explicit no-text instruction.",
    inputSchema: {
      planId: z.string().uuid(),
      prompt: z.string().min(10).max(4000),
      size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
      quality: z.enum(["low", "medium", "high"]).optional(),
    },
  }, async ({ planId, ...input }) => {
    const planState = requireApprovedPlan(planId);
    if ("error" in planState) return { content: [{ type: "text", text: JSON.stringify({ error: planState.error, retryable: false }, null, 2) }], isError: true };
    const result = await generateOpenAIImage({
      ...input,
      prompt: [
        `Approved campaign: ${planState.plan.brief.campaignName}`,
        `Objective: ${planState.plan.brief.objective}`,
        `Audience: ${planState.plan.brief.audience}`,
        `CTA: ${planState.plan.brief.callToAction}`,
        planState.plan.brandGuidelines ? `Brand guidelines: ${planState.plan.brandGuidelines}` : "Brand guidelines: no official logo or unsupported product claim.",
        planState.plan.requiredInImageText ? `Required in-image text: ${planState.plan.requiredInImageText}` : "In-image text: none; preserve clean overlay space.",
        `Executor brief: ${input.prompt}`,
      ].join("\n"),
    });
    recordImageGeneration(planId, !result.isError);
    return result;
  });

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
