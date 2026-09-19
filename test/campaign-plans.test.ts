import assert from "node:assert/strict";
import test from "node:test";
import { approveCampaignConcept, assessCampaignIntake, createCampaignPlan, getCampaignWorkflowStatus, recordImageGeneration, requireApprovedPlan } from "../src/campaign-plans.js";

const completeIntake = {
  campaignName: "Focus launch",
  product: "A focus app that helps remote teams protect deep-work time.",
  audience: "Remote team leads managing knowledge workers.",
  objective: "Drive qualified free-trial signups.",
  tone: "calm and credible",
  callToAction: "Start a free trial",
  platforms: ["linkedin"] as Array<"linkedin" | "instagram" | "facebook" | "tiktok">,
};

test("intake exposes only decision-critical missing questions", () => {
  const result = assessCampaignIntake({ product: completeIntake.product });
  assert.equal(result.readyForPlanning, false);
  assert.deepEqual(result.missingQuestions.map(question => question.field), ["objective", "audience", "platforms", "callToAction"]);
  assert.equal(result.missingQuestions.find(question => question.field === "objective")?.selection, "single");
  assert.equal(result.missingQuestions.find(question => question.field === "platforms")?.selection, "multiple");
  assert.equal(result.optionalPresentationQuestions[0]?.selection, "single");
});

test("planning supplies safe campaign-name and tone defaults", () => {
  const { campaignName: _campaignName, tone: _tone, ...minimumPlan } = completeIntake;
  const planned = createCampaignPlan(minimumPlan);
  assert.equal(planned.status, "awaiting_concept_approval");
  assert.equal(planned.campaignSummary?.campaignName, `Campaign for ${minimumPlan.product}`);
});

test("workflow status exposes active role, safe summary, and tool states", () => {
  const beforePlan = getCampaignWorkflowStatus();
  assert.equal(beforePlan.activeRole, "Orchestrator");
  assert.equal(beforePlan.tools.find(tool => tool.name === "assess_campaign_intake")?.state, "next");

  const planned = createCampaignPlan(completeIntake);
  const planning = getCampaignWorkflowStatus(planned.planId!);
  assert.equal(planning.activeRole, "Planner");
  assert.equal(planning.tools.find(tool => tool.name === "approve_campaign_concept")?.state, "next");

  approveCampaignConcept({ planId: planned.planId!, conceptId: "product-hero", approved: true });
  recordImageGeneration(planned.planId!, true);
  const delivered = getCampaignWorkflowStatus(planned.planId!);
  assert.equal(delivered.phase, "delivered");
  assert.equal(delivered.tools.find(tool => tool.name === "generate_image")?.state, "completed");
  assert.match(delivered.trueforgeSkills, /No native TrueForge skills/);
});

test("intake provides chat-first guidance without an interactive form contract", () => {
  const result = assessCampaignIntake({ product: completeIntake.product });
  assert.match(result.chatGuidance.format, /chat message/i);
  assert.match(result.chatGuidance.choices, /never as buttons/i);
  assert.match(result.chatGuidance.platforms, /comma-separated/i);
});

test("image execution remains locked until explicit concept approval", () => {
  const planned = createCampaignPlan(completeIntake);
  assert.equal(planned.status, "awaiting_concept_approval");
  assert.ok(planned.planId);
  const locked = requireApprovedPlan(planned.planId!);
  assert.ok("error" in locked);
  assert.match(locked.error, /locked/i);

  const approved = approveCampaignConcept({ planId: planned.planId!, conceptId: "product-hero", approved: true });
  assert.equal(approved.status, "approved_for_execution");
  assert.ok("plan" in requireApprovedPlan(planned.planId!));
});
