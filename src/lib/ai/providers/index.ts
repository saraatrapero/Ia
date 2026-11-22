import { PROVIDER_IDS, type ProviderId } from "../catalog";
import type { ProviderAdapter } from "../types";
import { anthropicAdapter } from "./anthropic";
import { googleAdapter } from "./google";
import { groqAdapter } from "./groq";
import { openaiAdapter } from "./openai";
import { openrouterAdapter } from "./openrouter";

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  groq: groqAdapter,
  openrouter: openrouterAdapter,
};

export function providerStatus() {
  return PROVIDER_IDS.map((id) => ({ id, configured: PROVIDERS[id].isConfigured() }));
}
