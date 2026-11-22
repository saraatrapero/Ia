import { openAICompatible } from "./openai-compatible";

export const openrouterAdapter = openAICompatible({
  id: "openrouter",
  name: "OpenRouter",
  envKey: "OPENROUTER_API_KEY",
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  systemRole: "system",
  extraHeaders: { "X-Title": "TRAPERO AI" },
});
