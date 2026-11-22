import OpenAI from "openai";
import type { ProviderId } from "../catalog";
import { ProviderError, type ProviderAdapter } from "../types";

interface Options {
  id: ProviderId;
  name: string;
  envKey: string;
  /** URL base (vacía = API oficial de OpenAI; también respeta OPENAI_BASE_URL) */
  baseURL?: string;
  /** OpenAI usa el rol "developer"; el resto de proveedores, "system" */
  systemRole: "developer" | "system";
  extraHeaders?: Record<string, string>;
}

/** Adaptador para OpenAI y proveedores con API compatible (Groq, OpenRouter). */
export function openAICompatible(opts: Options): ProviderAdapter {
  let client: OpenAI | null = null;
  const getClient = () =>
    (client ??= new OpenAI({
      apiKey: process.env[opts.envKey],
      ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
      defaultHeaders: opts.extraHeaders,
    }));

  const wrap = (err: unknown): never => {
    if (err instanceof OpenAI.APIUserAbortError) throw err;
    if (err instanceof OpenAI.RateLimitError)
      throw new ProviderError(opts.id, `Límite de uso de ${opts.name} alcanzado (en los planes gratuitos es por minuto o por día). Prueba con otro modelo o espera.`, true);
    if (err instanceof OpenAI.AuthenticationError) throw new ProviderError(opts.id, `La clave de API de ${opts.name} no es válida.`);
    if (err instanceof OpenAI.NotFoundError)
      throw new ProviderError(opts.id, `${opts.name} no reconoce el modelo. Revisa su identificador en Administración → Modelos.`, true);
    if (err instanceof OpenAI.APIError)
      throw new ProviderError(opts.id, `Error de ${opts.name} (${err.status ?? "red"}): ${err.message}`, (err.status ?? 500) >= 500);
    throw err;
  };

  return {
    id: opts.id,
    isConfigured: () => Boolean(process.env[opts.envKey]),

    async stream({ apiModel, system, messages, signal }, onText) {
      try {
        const stream = await getClient().chat.completions.create(
          {
            model: apiModel,
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: opts.systemRole, content: system }, ...messages],
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
        return wrap(err);
      }
    },

    async listModels() {
      try {
        const ids: string[] = [];
        for await (const m of getClient().models.list()) ids.push(m.id);
        return ids;
      } catch (err) {
        return wrap(err);
      }
    },
  };
}
