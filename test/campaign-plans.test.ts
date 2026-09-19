import assert from "node:assert/strict";
import test from "node:test";
import { approveCampaignConcept, assessCampaignIntake, createCampaignPlan, requireApprovedPlan } from "../src/campaign-plans.js";

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
