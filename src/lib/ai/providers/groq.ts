import { openAICompatible } from "./openai-compatible";

export const groqAdapter = openAICompatible({
  id: "groq",
  name: "Groq",
  envKey: "GROQ_API_KEY",
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  systemRole: "system",
});
