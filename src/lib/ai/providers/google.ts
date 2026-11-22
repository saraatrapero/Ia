import { GoogleGenAI, ApiError } from "@google/genai";
import { ProviderError, type ProviderAdapter } from "../types";

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  async stream({ apiModel, system, messages, signal }, onText) {
    try {
      const stream = await getClient().models.generateContentStream({
        model: apiModel,
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: { systemInstruction: system, abortSignal: signal },
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let servedModel: string | undefined;
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) onText(text);
        servedModel ??= chunk.modelVersion;
        const u = chunk.usageMetadata;
        if (u) {
          inputTokens = u.promptTokenCount ?? inputTokens;
          outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || outputTokens;
        }
      }
      return { inputTokens, outputTokens, servedModel };
    } catch (err) {
      if (signal?.aborted) throw err;
      if (err instanceof ApiError) {
        if (err.status === 429)
          throw new ProviderError("google", "Límite de peticiones de Google alcanzado. Inténtalo en unos segundos.", true);
        if (err.status === 401 || err.status === 403)
          throw new ProviderError("google", "La clave de API de Gemini no es válida o no tiene permisos.");
        throw new ProviderError("google", `Error de Google (${err.status}): ${err.message}`, err.status >= 500);
      }
      throw err;
    }
  },
};
