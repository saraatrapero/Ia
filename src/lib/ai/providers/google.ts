import { GoogleGenAI, ApiError } from "@google/genai";
import { ProviderError, type ProviderAdapter } from "../types";

let client: GoogleGenAI | null = null;
function getClient() {
  if (!client)
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      // v1beta incluye los modelos «preview»; la versión estable (v1, por defecto en el SDK) no los ofrece
      httpOptions: { apiVersion: "v1beta", ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}) },
    });
  return client;
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  async listModels() {
    try {
      const ids: string[] = [];
      let pager = await getClient().models.list({ config: { pageSize: 1000 } });
      for (let pages = 0; pages < 20; pages++) {
        for (const m of pager.page) if (m.name) ids.push(m.name.replace(/^models\//, ""));
        if (!pager.hasNextPage()) break;
        await pager.nextPage();
      }
      return ids;
    } catch (err) {
      if (err instanceof ApiError) throw new ProviderError("google", `Error de Google (${err.status}): ${err.message}`);
      throw err;
    }
  },

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
          throw new ProviderError("google", "Límite de uso de Gemini alcanzado (en el nivel gratuito es por minuto y por día). Prueba con otro modelo o espera.", true);
        if (err.status === 503)
          throw new ProviderError("google", "Gemini está saturado en este momento (alta demanda). Se prueba con otro modelo.", true);
        if (err.status === 404)
          throw new ProviderError("google", "Google no reconoce el modelo. Revisa su identificador en Administración → Modelos.", true);
        if (err.status === 401 || err.status === 403)
          throw new ProviderError("google", "La clave de API de Gemini no es válida o no tiene permisos.");
        throw new ProviderError("google", `Error de Google (${err.status}): ${err.message}`, err.status >= 500);
      }
      throw err;
    }
  },
};
