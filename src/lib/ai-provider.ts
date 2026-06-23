import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function getAiModel() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const openrouter = createOpenAI({
      apiKey: openRouterKey,
      baseURL: OPENROUTER_BASE_URL,
    });
    const modelId = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
    return openrouter(modelId);
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    const openai = createOpenAI({ apiKey: openAiKey });
    const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    return openai(modelId);
  }

  return null;
}

export function hasAiProvider(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
}
