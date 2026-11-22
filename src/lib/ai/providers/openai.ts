import { openAICompatible } from "./openai-compatible";

export const openaiAdapter = openAICompatible({
  id: "openai",
  name: "OpenAI",
  envKey: "OPENAI_API_KEY",
  systemRole: "developer",
});
