import { errorResult, jsonResult, type ToolResult } from "./types.js";
import { saveGeneratedPng } from "./assets.js";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

function buildAdvertisingPrompt(creativeBrief: string, size: "1024x1024" | "1024x1536" | "1536x1024"): string {
  const placement = size === "1536x1024"
    ? "landscape paid-social placement"
    : size === "1024x1536"
      ? "vertical paid-social placement"
      : "square paid-social placement";
  return [
    "Create one polished, production-ready static advertising image.",
    `Intended use: ${placement}.`,
    "Use the brief as the source of truth. Where a non-essential creative choice is absent, make a coherent, premium advertising decision rather than asking the viewer a question.",
    "Campaign creative brief:",
    creativeBrief.trim(),
    "Creative constraints: use one clear focal subject; make the campaign benefit visually legible at a glance; use deliberate composition, concrete lighting, and a cohesive color palette; preserve clean negative space for a future text overlay; avoid watermarks, UI chrome, mock browser frames, and unrequested logos.",
    "Do not add any text, brand name, or call-to-action inside the image unless the creative brief supplies the exact wording and placement.",
  ].join("\n\n");
}

export async function generateOpenAIImage(input: {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}): Promise<ToolResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResult(
      "OpenAI image generation is not configured",
      "Set OPENAI_API_KEY on the CampaignForge MCP server. This is separate from the OpenAI provider configured in TrueForge.",
    );
  }

  try {
    const response = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
        prompt: buildAdvertisingPrompt(input.prompt, input.size || "1024x1024"),
        n: 1,
        size: input.size || "1024x1024",
        quality: input.quality || process.env.OPENAI_IMAGE_QUALITY || "low",
        output_format: "png",
      }),
    });
    const body = await response.json() as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
      error?: { message?: string };
    };
    const image = body.data?.[0];
    const encodedImage = image?.b64_json;
    if (!response.ok || !encodedImage) {
      return errorResult(body.error?.message || `OpenAI Images API returned ${response.status}`, "Check API billing, model access, and the request prompt.");
    }
    const asset = await saveGeneratedPng(encodedImage);
    const inlineMarkdown = `![Generated campaign image](${asset.url})`;
    return jsonResult({
      provider: "openai",
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
      status: "completed",
      assetUrl: asset.url,
      inlineMarkdown,
      revisedPrompt: image.revised_prompt,
      renderInstruction: "In your final response, put inlineMarkdown on its own line exactly as provided. It renders the generated PNG directly in the chat. Do not replace it with a sandbox file, SVG, or download link.",
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "OpenAI image generation failed", "Do not retry automatically if the error is a billing or policy failure.");
  }
}
