import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type ProviderAdapter } from "../types";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Modelos con respaldo automático en servidor ante una negativa por políticas. */
const SERVER_FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]);

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async stream({ apiModel, system, messages, signal }, onText) {
    const useFallback = SERVER_FALLBACK_MODELS.has(apiModel);
    try {
      const stream = getClient().beta.messages.stream(
        {
          model: apiModel,
          max_tokens: 64000,
          system,
          messages,
          // Caché automática del prefijo: abarata conversaciones largas y documentos adjuntos.
          cache_control: { type: "ephemeral" },
          output_config: { effort: "medium" },
          ...(useFallback
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
        },
        { signal },
      );

      stream.on("text", (delta) => onText(delta));
      const final = await stream.finalMessage();

      if (final.stop_reason === "refusal") {
        onText("\n\n_El modelo ha declinado responder a esta petición por sus políticas de uso._");
      } else if (final.stop_reason === "max_tokens") {
        onText("\n\n_La respuesta se ha cortado por alcanzar el límite de longitud._");
      }

      const u = final.usage;
      return {
        inputTokens:
          (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        servedModel: final.model,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) throw err;
      if (err instanceof Anthropic.RateLimitError)
        throw new ProviderError("anthropic", "Límite de peticiones de Anthropic alcanzado. Inténtalo en unos segundos.", true);
      if (err instanceof Anthropic.AuthenticationError)
        throw new ProviderError("anthropic", "La clave de API de Anthropic no es válida.");
      if (err instanceof Anthropic.APIError)
        throw new ProviderError("anthropic", `Error de Anthropic (${err.status ?? "red"}): ${err.message}`, (err.status ?? 500) >= 500);
      throw err;
    }
  },
};
