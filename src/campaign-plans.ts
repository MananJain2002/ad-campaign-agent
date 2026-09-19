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
  imageGenerated: boolean;
  activity: WorkflowActivity[];
  createdAt: string;
};

const plans = new Map<string, CampaignPlan>();

type WorkflowRole = "Orchestrator" | "Planner" | "Executor";
type WorkflowActivity = {
  role: WorkflowRole;
  tool: string;
  summary: string;
  at: string;
};

type Choice = { value: string; label: string; description?: string };
type IntakeQuestion = {
  field: keyof CampaignIntake;
  question: string;
  why: string;
  selection: "text" | "single" | "multiple";
  placeholder?: string;
  options?: Choice[];
};

function openUiString(value: string) {
  return JSON.stringify(value);
}

const objectiveChoices: Choice[] = [
  { value: "Build awareness", label: "Build awareness", description: "Make more of the right people aware of the offer." },
  { value: "Generate leads", label: "Generate leads", description: "Drive enquiries, sign-ups, or qualified contacts." },
  { value: "Drive sales", label: "Drive sales", description: "Motivate a purchase or conversion now." },
  { value: "Drive app installs", label: "Drive app installs", description: "Acquire new app users." },
  { value: "Promote an event", label: "Promote an event", description: "Drive registrations or attendance." },
];

const platformChoices: Choice[] = [
  { value: "linkedin", label: "LinkedIn", description: "Professional feed placement." },
  { value: "instagram", label: "Instagram", description: "Feed, Story, or Reel creative." },
  { value: "facebook", label: "Facebook", description: "Feed and paid social placement." },
  { value: "tiktok", label: "TikTok", description: "Vertical, discovery-led placement." },
];

const styleChoices: Choice[] = [
  { value: "photorealistic product photography", label: "Photorealistic", description: "Polished, studio-quality campaign photography." },
  { value: "cinematic editorial", label: "Cinematic", description: "Dramatic lighting and a premium editorial mood." },
  { value: "clean graphic design", label: "Graphic", description: "Bold, minimal shapes and an art-directed layout." },
  { value: "warm lifestyle photography", label: "Lifestyle", description: "Natural, human and aspirational." },
];

const questions: IntakeQuestion[] = [
  { field: "product", question: "What product, service, or offer should this campaign promote?", why: "The hero subject and claims cannot be inferred safely.", selection: "text", placeholder: "Describe the product, offer, and any facts that must be accurate." },
  { field: "objective", question: "What is the primary campaign outcome?", why: "The objective determines the message and CTA.", selection: "single", options: objectiveChoices },
  { field: "audience", question: "Who is the specific target audience?", why: "Audience changes the creative, tone, and proof points.", selection: "text", placeholder: "For example: founders at 10–100 person SaaS companies." },
  { field: "platforms", question: "Where will this ad run? Select every platform that applies.", why: "Placement determines dimensions, pacing, and copy treatment.", selection: "multiple", options: platformChoices },
  { field: "callToAction", question: "What should a viewer do after seeing the ad?", why: "The CTA anchors the campaign message.", selection: "text", placeholder: "For example: Start a free trial, Shop now, or Book a demo." },
];

const optionalPresentationQuestions: IntakeQuestion[] = [
  { field: "tone", question: "Choose a visual direction (optional).", why: "This guides the first creative direction but is not required to plan.", selection: "single", options: styleChoices },
  { field: "requiredInImageText", question: "Should the image contain exact text?", why: "Generated text can be unreliable, so exact legal copy or a headline must be supplied deliberately.", selection: "text", placeholder: "Leave blank for a no-text image with clean overlay space." },
];

export function assessCampaignIntake(intake: CampaignIntake) {
  const missing = questions.filter(item => {
    const value = intake[item.field];
    return value === undefined || (Array.isArray(value) && value.length === 0);
  });
  return {
    readyForPlanning: missing.length === 0,
    missingQuestions: missing.map(({ field, question, why, selection, placeholder, options }) => ({ field, question, why, selection, placeholder, options })),
    optionalPresentationQuestions,
    uiContract: {
      singleChoice: "Render a RadioGroup. Exactly one option can be selected.",
      multipleChoice: "Render a CheckBoxGroup. The user may select any number of options.",
      submittedValues: "On submit, send the form values to the assistant. Convert checked platform keys to the platforms array and use the selected visual direction as tone.",
    },
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

/**
 * Builds valid openui-lang on the server so the model never has to invent the
 * radio/checkbox syntax when CampaignForge asks for missing brief details.
 */
export function renderCampaignIntakeForm(intake: CampaignIntake) {
  const assessment = assessCampaignIntake(intake);
  if (assessment.readyForPlanning) {
    return { status: "not_needed", message: "The intake is complete. Create the campaign plan instead of rendering a form." };
  }

  const fields: string[] = [];
  const definitions: string[] = [];
  for (const question of assessment.missingQuestions) {
    const fieldName = `${question.field}Field`;
    fields.push(fieldName);
    if (question.selection === "text") {
      definitions.push(`${fieldName} = FormControl(${openUiString(question.question)}, Input(${openUiString(question.field)}, ${openUiString(question.placeholder || "Enter a value")}, "text", {required: true}))`);
      continue;
    }
    const items: string[] = [];
    for (const option of question.options || []) {
      const itemName = `${question.field}${option.value.replace(/[^a-zA-Z0-9]/g, "")}`;
      items.push(itemName);
      if (question.selection === "single") {
        definitions.push(`${itemName} = RadioItem(${openUiString(option.label)}, ${openUiString(option.description || "")}, ${openUiString(option.value)})`);
      } else {
        definitions.push(`${itemName} = CheckBoxItem(${openUiString(option.label)}, ${openUiString(option.description || "")}, ${openUiString(option.value)})`);
      }
    }
    const control = question.selection === "single"
      ? `RadioGroup(${openUiString(question.field)}, [${items.join(", ")}], null, {required: true})`
      : `CheckBoxGroup(${openUiString(question.field)}, [${items.join(", ")}])`;
    definitions.unshift(`${fieldName} = FormControl(${openUiString(question.question)}, ${control})`);
  }

  const visualItems = styleChoices.map(option => `tone${option.value.replace(/[^a-zA-Z0-9]/g, "")}`);
  fields.push("toneField", "inImageTextField");
  definitions.push(`toneField = FormControl("Visual direction (optional)", RadioGroup("tone", [${visualItems.join(", ")}]))`);
  for (const option of styleChoices) {
    const itemName = `tone${option.value.replace(/[^a-zA-Z0-9]/g, "")}`;
    definitions.push(`${itemName} = RadioItem(${openUiString(option.label)}, ${openUiString(option.description || "")}, ${openUiString(option.value)})`);
  }
  definitions.push('inImageTextField = FormControl("Exact in-image text (optional)", Input("requiredInImageText", "Leave blank for a no-text image", "text"))');

  const openui = [
    `root = Stack([heading, helper, form])`,
    `heading = TextContent("Campaign setup", "large-heavy")`,
    `helper = TextContent("Choose one where required; select every platform that applies.")`,
    `form = Form("campaign-brief", buttons, [${fields.join(", ")}])`,
    ...definitions,
    'buttons = Buttons([Button("Continue to plan", Action([@ToAssistant("Submit campaign brief")]), "primary")])',
  ].join("\n");

  return {
    status: "form_ready",
    form: `\`\`\`openui\n${openui}\n\`\`\``,
    submissionContract: "Return form exactly as supplied. On submit, merge fields with known facts, convert checked platform keys to a platforms array, and call assess_campaign_intake again.",
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
  const brief = campaignBriefSchema.parse({
    ...input,
    campaignName: input.campaignName || `Campaign for ${input.product}`,
    tone: input.tone || "clear, modern, brand-appropriate",
    assetUrls: input.assetUrls || [],
  });
  const plan: CampaignPlan = {
    id: randomUUID(),
    brief,
    brandGuidelines: input.brandGuidelines,
    requiredInImageText: input.requiredInImageText,
    concepts: conceptsFor(brief),
    approved: false,
    imageGenerated: false,
    activity: [{ role: "Planner", tool: "create_campaign_plan", summary: "Created three concepts and opened the concept-approval gate.", at: new Date().toISOString() }],
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
  plan.activity.push({ role: "Orchestrator", tool: "approve_campaign_concept", summary: `Recorded the user's approval for ${concept.name}.`, at: new Date().toISOString() });
  return { status: "approved_for_execution", planId: plan.id, selectedConcept: concept, instruction: "The executor may now call generate_image with this planId and a production-ready creative brief." };
}

export function recordImageGeneration(planId: string, success: boolean) {
  const plan = plans.get(planId);
  if (!plan) return;
  plan.imageGenerated = success;
  plan.activity.push({
    role: "Executor",
    tool: "generate_image",
    summary: success ? "Generated the approved campaign image." : "Attempted image generation, but no final image was produced.",
    at: new Date().toISOString(),
  });
}

export function getCampaignWorkflowStatus(planId?: string) {
  const roleDefinitions = [
    { role: "Orchestrator", responsibility: "Coordinates the workflow, approval gate, and delivery." },
    { role: "Planner", responsibility: "Collects the brief and creates campaign concepts." },
    { role: "Executor", responsibility: "Produces an image only after concept approval." },
  ];
  const tools = [
    { name: "assess_campaign_intake", role: "Planner", purpose: "Checks missing brief details." },
    { name: "create_campaign_plan", role: "Planner", purpose: "Creates the three concepts." },
    { name: "approve_campaign_concept", role: "Orchestrator", purpose: "Records human approval." },
    { name: "generate_image", role: "Executor", purpose: "Creates the approved PNG." },
  ];
  const projectGuides = [
    { name: "campaign-brief", role: "Planner", purpose: "Structured intake and completeness checks." },
    { name: "campaign-strategy", role: "Planner", purpose: "Concept and positioning guidance." },
    { name: "campaign-creative", role: "Executor", purpose: "Production-brief guidance for images." },
  ];
  if (!planId) {
    return {
      phase: "intake",
      activeRole: "Orchestrator",
      activeAgent: "campaignforge-orchestrator",
      executionModel: "One user-facing TrueForge agent switches between constrained Orchestrator, Planner, and Executor roles; these are not hidden subagent runs.",
      decisionSummary: "Awaiting the minimum campaign brief before planning.",
      roles: roleDefinitions.map(item => ({ ...item, state: item.role === "Orchestrator" ? "active" : "waiting" })),
      tools: tools.map(item => ({ ...item, state: item.name === "assess_campaign_intake" ? "next" : "waiting" })),
      projectGuides,
      trueforgeSkills: "No native TrueForge skills are attached to this saved agent yet; project guides are shown separately.",
      activity: [],
    };
  }
  const plan = plans.get(planId);
  if (!plan) return { error: "Campaign plan was not found. Start a new campaign intake.", retryable: true };
  const phase = plan.imageGenerated ? "delivered" : plan.approved ? "execution" : "concept_approval";
  const activeRole: WorkflowRole = plan.imageGenerated ? "Orchestrator" : plan.approved ? "Executor" : "Planner";
  const toolState = (name: string) => plan.activity.some(item => item.tool === name) ? "completed" : (
    name === "generate_image" && plan.approved ? "next" :
    name === "approve_campaign_concept" && !plan.approved ? "next" : "waiting"
  );
  return {
    phase,
    activeRole,
    activeAgent: "campaignforge-orchestrator",
    executionModel: "One user-facing TrueForge agent switches between constrained Orchestrator, Planner, and Executor roles; these are not hidden subagent runs.",
    decisionSummary: plan.imageGenerated
      ? "The approved image is complete; the orchestrator can deliver it or handle a targeted revision."
      : plan.approved
        ? "The selected concept is approved; the executor may generate the image."
        : "Three concepts are ready; waiting for the user's selection and explicit approval.",
    roles: roleDefinitions.map(item => ({ ...item, state: item.role === activeRole ? "active" : plan.activity.some(event => event.role === item.role) ? "completed" : "waiting" })),
    tools: tools.map(item => ({ ...item, state: toolState(item.name) })),
    projectGuides,
    trueforgeSkills: "No native TrueForge skills are attached to this saved agent yet; project guides are shown separately.",
    activity: plan.activity,
  };
}

export function requireApprovedPlan(planId: string): { plan: CampaignPlan } | { error: string } {
  const plan = plans.get(planId);
  if (!plan) return { error: "Campaign plan was not found. Start with assess_campaign_intake and create_campaign_plan." };
  if (!plan.approved || !plan.selectedConceptId) return { error: "Image generation is locked until the user selects and explicitly approves a concept." };
  return { plan };
}
