import assert from "node:assert/strict";
import test from "node:test";
import { generateOpenAIImage } from "../src/openai-image.js";

test("OpenAI image generation fails safely when no API key is configured", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const result = await generateOpenAIImage({ prompt: "A clean editorial advertisement for a focus app" });
  const text = result.content.find((item): item is { type: "text"; text: string } => item.type === "text");
  assert.ok(text);
  assert.match(text.text, /OPENAI_API_KEY/);
  if (previous) process.env.OPENAI_API_KEY = previous;
});
