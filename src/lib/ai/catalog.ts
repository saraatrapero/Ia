/**
 * Catálogo inicial de modelos. Se copia a la base de datos con el seed y
 * después se gestiona desde Administración → Modelos (activar, precios, ids).
 *
 * Precios en USD por millón de tokens. Los de Anthropic son tarifas oficiales;
 * los de OpenAI y Google son orientativos y deben verificarse en la web del
 * proveedor antes de usarlos para facturación interna.
 */
export type ProviderId = "openai" | "anthropic" | "google";
export type Tier = "fast" | "balanced" | "advanced";

export interface CatalogModel {
  id: string;
  provider: ProviderId;
  apiModel: string;
  label: string;
  description: string;
  tier: Tier;
  strengths: string[];
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  minRole?: "MEMBER" | "MANAGER" | "ADMIN";
}

export const DEFAULT_MODELS: CatalogModel[] = [
  {
    id: "claude-opus",
    provider: "anthropic",
    apiModel: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Razonamiento profundo, análisis complejos, estrategia y programación exigente.",
    tier: "advanced",
    strengths: ["analysis", "code", "reasoning", "long-context"],
    inputPrice: 4,
    outputPrice: 20,
    contextWindow: 1_000_000,
  },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    apiModel: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Equilibrio entre velocidad y capacidad. Muy bueno en programación y redacción.",
    tier: "balanced",
    strengths: ["code", "writing", "analysis"],
    inputPrice: 2,
    outputPrice: 10,
    contextWindow: 1_000_000,
  },
  {
    id: "claude-haiku",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Respuestas rápidas y económicas para tareas sencillas.",
    tier: "fast",
    strengths: ["general", "fast"],
    inputPrice: 0.1,
    outputPrice: 0.5,
    contextWindow: 1_000_000,
  },
  {
    id: "gpt-advanced",
    provider: "openai",
    apiModel: "gpt-6.2-sol",
    label: "GPT-6.2 Sol",
    description: "Modelo avanzado de OpenAI para tareas generales y creativas.",
    tier: "advanced",
    strengths: ["writing", "general", "reasoning"],
    inputPrice: 5,
    outputPrice: 20,
    contextWindow: 400_000,
  },
  {
    id: "gpt-fast",
    provider: "openai",
    apiModel: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Modelo rápido y económico de OpenAI.",
    tier: "fast",
    strengths: ["general", "fast"],
    inputPrice: 0.4,
    outputPrice: 1.6,
    contextWindow: 400_000,
  },
  {
    id: "gemini-pro",
    provider: "google",
    apiModel: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Documentos muy largos, datos y análisis multimodal.",
    tier: "advanced",
    strengths: ["long-context", "analysis", "data"],
    inputPrice: 2,
    outputPrice: 12,
    contextWindow: 1_000_000,
  },
  {
    id: "gemini-flash",
    provider: "google",
    apiModel: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    description: "Rápido y barato, con contexto muy amplio.",
    tier: "fast",
    strengths: ["fast", "long-context", "general"],
    inputPrice: 0.3,
    outputPrice: 2.5,
    contextWindow: 1_000_000,
  },
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI · GPT",
  anthropic: "Anthropic · Claude",
  google: "Google · Gemini",
};

export const TIER_LABELS: Record<Tier, string> = {
  fast: "Rápido",
  balanced: "Equilibrado",
  advanced: "Avanzado",
};
