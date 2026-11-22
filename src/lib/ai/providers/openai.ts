import OpenAI from "openai";
import { ProviderError, type ProviderAdapter } from "../types";

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  async stream({ apiModel, system, messages, signal }, onText) {
    try {
      const stream = await getClient().chat.completions.create(
        {
          model: apiModel,
          stream: true,
          stream_options: { include_usage: true },
          messages: [{ role: "developer", content: system }, ...messages],
        },
        { signal },
      );

      let inputTokens = 0;
      let outputTokens = 0;
      let servedModel: string | undefined;
      for await (const chunk of stream) {
        servedModel ??= chunk.model;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) onText(delta);
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }
      return { inputTokens, outputTokens, servedModel };
    } catch (err) {
      if (err instanceof OpenAI.APIUserAbortError) throw err;
      if (err instanceof OpenAI.RateLimitError)
        throw new ProviderError("openai", "Límite de peticiones de OpenAI alcanzado. Inténtalo en unos segundos.", true);
      if (err instanceof OpenAI.AuthenticationError)
        throw new ProviderError("openai", "La clave de API de OpenAI no es válida.");
      if (err instanceof OpenAI.APIError)
        throw new ProviderError("openai", `Error de OpenAI (${err.status ?? "red"}): ${err.message}`, (err.status ?? 500) >= 500);
      throw err;
    }
  },
};
