import { randomUUID } from "node:crypto";
import { z } from "zod";
import { campaignBriefSchema, type CampaignBrief } from "./types.js";

const intakeSchema = z.object({
  campaignName: z.string().min(2).max(100).optional(),
  product: z.string().min(10).max(2000).optional(),
  audience: z.string().min(5).max(1000).optional(),
  objective: z.string().min(5).max(500).optional(),
  tone: z.string().min(2).max(120).optional(),
  callToAction: z.string().min(2).max(120).optional(),
  platforms: z.array(z.enum(["linkedin", "instagram", "facebook", "tiktok"])).min(1).optional(),
  assetUrls: z.array(z.string().url()).max(10).optional(),
  researchUrl: z.string().url().optional(),
  brandGuidelines: z.string().min(5).max(2000).optional(),
  requiredInImageText: z.string().min(1).max(200).optional(),
});

export type CampaignIntake = z.infer<typeof intakeSchema>;
export const campaignIntakeInputSchema = intakeSchema;

export type CampaignConcept = {
  id: "product-hero" | "audience-moment" | "benefit-proof";
  name: string;
  strategy: string;
  visualDirection: string;
};

type CampaignPlan = {
  id: string;
  brief: CampaignBrief;
  brandGuidelines?: string;
  requiredInImageText?: string;
  concepts: CampaignConcept[];
  selectedConceptId?: CampaignConcept["id"];
  approved: boolean;
  createdAt: string;
};

const plans = new Map<string, CampaignPlan>();

const questions: Array<{ key: keyof CampaignIntake; question: string; why: string }> = [
  { key: "product", question: "What product, service, or offer should this campaign promote?", why: "The hero subject and claims cannot be inferred safely." },
  { key: "objective", question: "What is the primary outcome: awareness, leads, sales, app installs, event registrations, or something else?", why: "The objective determines the message and CTA." },
  { key: "audience", question: "Who is the specific target audience?", why: "Audience changes the creative, tone, and proof points." },
  { key: "platforms", question: "Where will this ad run (for example, LinkedIn, Instagram feed, Instagram story, Facebook, or TikTok)?", why: "Placement determines dimensions, pacing, and copy treatment." },
  { key: "callToAction", question: "What should a viewer do after seeing the ad?", why: "The CTA anchors the campaign message." },
];

export function assessCampaignIntake(intake: CampaignIntake) {
  const missing = questions.filter(item => {
    const value = intake[item.key];
    return value === undefined || (Array.isArray(value) && value.length === 0);
  });
  return {
    readyForPlanning: missing.length === 0,
    missingQuestions: missing.map(({ key, question, why }) => ({ field: key, question, why })),
    optionalInformation: [
      "Brand assets or official logo/product photo (only if it must appear exactly)",
      "Brand colors, typography, and prohibited claims",
      "Exact in-image text or legal copy; otherwise the image will be no-text with overlay space",
    ],
    instruction: missing.length
      ? "Ask only the listed missing questions in one concise batch. Do not create a plan or generate an asset yet."
      : "Create a campaign plan next; do not generate an asset until a concept is selected and explicitly approved.",
  };
}

function conceptsFor(brief: CampaignBrief): CampaignConcept[] {
  return [
    {
      id: "product-hero",
      name: "Product hero",
      strategy: `Make the product or offer the immediate proof of ${brief.objective}.`,
      visualDirection: "A premium, uncluttered hero composition with deliberate negative space for campaign copy.",
    },
    {
      id: "audience-moment",
      name: "Audience moment",
      strategy: `Show ${brief.audience} in the moment immediately before or after the product benefit.`,
      visualDirection: "An authentic contextual scene that privileges human relevance over product scale.",
    },
    {
      id: "benefit-proof",
      name: "Benefit proof",
      strategy: `Make the benefit behind ${brief.callToAction} visually obvious without inventing claims.`,
      visualDirection: "An editorial demonstration or outcome-led composition with one clear visual metaphor.",
    },
  ];
}

export function createCampaignPlan(input: CampaignIntake) {
  const readiness = assessCampaignIntake(input);
  if (!readiness.readyForPlanning) return { ...readiness, plan: undefined };
  const brief = campaignBriefSchema.parse({ ...input, assetUrls: input.assetUrls || [] });
  const plan: CampaignPlan = {
    id: randomUUID(),
    brief,
    brandGuidelines: input.brandGuidelines,
    requiredInImageText: input.requiredInImageText,
    concepts: conceptsFor(brief),
    approved: false,
    createdAt: new Date().toISOString(),
  };
  plans.set(plan.id, plan);
  return {
    status: "awaiting_concept_approval",
    planId: plan.id,
    campaignSummary: { campaignName: brief.campaignName, objective: brief.objective, audience: brief.audience, platforms: brief.platforms, callToAction: brief.callToAction },
    concepts: plan.concepts,
    approvalPrompt: "Choose one concept by id and explicitly approve it. No image will be generated before approval.",
  };
}

export function approveCampaignConcept(input: { planId: string; conceptId: CampaignConcept["id"]; approved: boolean }) {
  const plan = plans.get(input.planId);
  if (!plan) return { error: "Campaign plan was not found. Create a new plan in this active CampaignForge session.", retryable: true };
  if (!input.approved) return { status: "revision_requested", planId: plan.id, message: "Keep planning. Ask for the requested change, then create a new plan before generating an asset." };
  const concept = plan.concepts.find(item => item.id === input.conceptId);
  if (!concept) return { error: "Concept does not belong to this campaign plan.", retryable: false };
  plan.selectedConceptId = input.conceptId;
  plan.approved = true;
  return { status: "approved_for_execution", planId: plan.id, selectedConcept: concept, instruction: "The executor may now call generate_image with this planId and a production-ready creative brief." };
}

export function requireApprovedPlan(planId: string): { plan: CampaignPlan } | { error: string } {
  const plan = plans.get(planId);
  if (!plan) return { error: "Campaign plan was not found. Start with assess_campaign_intake and create_campaign_plan." };
  if (!plan.approved || !plan.selectedConceptId) return { error: "Image generation is locked until the user selects and explicitly approves a concept." };
  return { plan };
}
