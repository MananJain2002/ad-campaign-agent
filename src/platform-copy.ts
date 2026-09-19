import type { CampaignConcept } from "./campaign-plans.js";
import type { CampaignBrief, Platform } from "./types.js";

type CopyGuidanceInput = {
  brief: CampaignBrief;
  selectedConcept: CampaignConcept;
  copyDirection?: string;
};

type PlatformGuide = {
  platform: Platform;
  audienceFit: string;
  writingDirection: string;
  format: string;
  avoid: string;
};

const guides: Record<Platform, Omit<PlatformGuide, "platform">> = {
  linkedin: {
    audienceFit: "Professional, decision-oriented readers who value relevance, clarity, and credible business context.",
    writingDirection: "Lead with a crisp professional insight or outcome. Explain the campaign value in plain language, then connect it to the supplied audience and CTA. Keep the voice confident and useful rather than hype-driven.",
    format: "A strong opening line, one or two short supporting paragraphs, a natural CTA, and zero to three precise hashtags only when useful.",
    avoid: "Casual slang, engagement bait, unsupported statistics, exaggerated superlatives, and a dense wall of hashtags.",
  },
  instagram: {
    audienceFit: "Visual-first social audiences responding to a clear feeling, aesthetic, or lifestyle/product moment.",
    writingDirection: "Open with the visual feeling or most immediate benefit. Write warmly and naturally in the supplied brand tone, using concise line breaks to support the image rather than restate every visual detail.",
    format: "A short hook, two to four compact lines, a light CTA when supplied, and up to five relevant hashtags only when they improve discoverability.",
    avoid: "Corporate boilerplate, long feature inventories, forced slang, generic engagement bait, and hashtag stuffing.",
  },
  facebook: {
    audienceFit: "Broad community-oriented audiences who benefit from direct context and an approachable explanation of why the offer matters.",
    writingDirection: "Start with a relatable customer benefit, state the offer clearly, and make the next action easy to understand. Keep it conversational, useful, and grounded in supplied facts.",
    format: "One clear opening sentence, one short explanatory paragraph, a plain-language CTA when supplied, and zero to three relevant hashtags only when useful.",
    avoid: "Clickbait, vague claims, excessive emoji, unsupported social proof, and jargon that hides the actual benefit.",
  },
  tiktok: {
    audienceFit: "Fast-scrolling, culture-aware audiences who need an immediate, human-readable hook before deciding to pause.",
    writingDirection: "Make the first line sharp, conversational, and specific to the audience or moment. Keep the copy brief enough to pair with a static image ad; use an authentic voice without pretending to know a trend or forcing slang.",
    format: "One hook-led caption of one to three short lines, a light CTA when supplied, and up to five relevant hashtags only when useful.",
    avoid: "Invented trend references, forced Gen-Z language, long explanatory copy, unsupported claims, and hashtag stuffing.",
  },
};

/**
 * Gives the Executor per-platform editorial direction. The Executor is the
 * writer: it uses this grounded guidance and the approved campaign facts to
 * produce the actual copy visible to the user.
 */
export function buildPlatformCopyGuidance(input: CopyGuidanceInput) {
  const platformGuides: PlatformGuide[] = input.brief.platforms.map(platform => ({ platform, ...guides[platform] }));
  return {
    status: "ready_for_executor_copy",
    campaignContext: {
      campaignName: input.brief.campaignName,
      product: input.brief.product,
      objective: input.brief.objective,
      audience: input.brief.audience,
      tone: input.brief.tone,
      callToAction: input.brief.callToAction,
      visualFocus: input.brief.visualFocus,
      selectedConcept: {
        name: input.selectedConcept.name,
        strategy: input.selectedConcept.strategy,
        visualDirection: input.selectedConcept.visualDirection,
      },
      copyDirection: input.copyDirection || "Write useful, platform-native campaign copy that complements the approved creative.",
    },
    platformGuides,
    executorInstructions: [
      "Write one final, ready-to-use post caption for every requested platform, using each platform's guide rather than repeating a single caption.",
      "Use supplied facts for every product feature, price, proof point, date, customer result, and claim. Do not manufacture specificity to make a caption sound stronger.",
      "Keep the campaign message coherent across platforms while adapting hook, tone, length, and CTA to the platform.",
      "Return user-facing Markdown only: `## Campaign copy`, then one `### Platform` section per requested platform. Do not mention prompts, tools, agents, or internal process.",
    ],
  };
}
