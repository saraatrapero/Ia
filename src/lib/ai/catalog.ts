/**
 * Catálogo inicial de modelos. Se copia a la base de datos al instalar y después se
 * gestiona desde Administración → Modelos (activar, precios, identificadores, gratuito).
 *
 * Precios en USD por millón de tokens. Los de Anthropic son tarifas oficiales; el resto
 * son orientativos. Los identificadores de proveedores gratuitos cambian con frecuencia:
 * usa «Comprobar proveedores» en el panel para verificar cuáles existen hoy.
 */
export type ProviderId = "openai" | "anthropic" | "google" | "groq" | "openrouter";
export type Tier = "fast" | "balanced" | "advanced";

export const PROVIDER_IDS: ProviderId[] = ["google", "groq", "openrouter", "anthropic", "openai"];

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
  free?: boolean;
  vision?: boolean;
  minRole?: "MEMBER" | "MANAGER" | "ADMIN";
}

export const DEFAULT_MODELS: CatalogModel[] = [
  // ── Gratuitos ───────────────────────────────────────────────
  {
    id: "gemini-flash",
    provider: "google",
    apiModel: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    description: "Gratuito (nivel sin coste de Google). Rápido, contexto muy amplio y documentos largos.",
    tier: "balanced",
    strengths: ["general", "long-context", "data", "writing", "fast"],
    inputPrice: 0.3,
    outputPrice: 2.5,
    contextWindow: 1_000_000,
    free: true,
    vision: true,
  },
  {
    id: "gemini-flash-lite",
    provider: "google",
    apiModel: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    description: "Gratuito (nivel sin coste de Google). El más rápido y ligero de Gemini; respaldo cuando Flash está saturado.",
    tier: "fast",
    strengths: ["general", "fast", "long-context"],
    inputPrice: 0.1,
    outputPrice: 0.4,
    contextWindow: 1_000_000,
    free: true,
    vision: true,
  },
  {
    id: "gemma",
    provider: "google",
    apiModel: "gemma-4-31b-it",
    label: "Gemma 4 31B",
    description: "Gratuito. Modelo abierto de Google servido por la API de Gemini, con su propio cupo de uso.",
    tier: "balanced",
    strengths: ["general", "writing", "reasoning"],
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 262_144,
    free: true,
  },
  {
    id: "groq-gpt-oss",
    provider: "groq",
    apiModel: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B (Groq)",
    description: "Gratuito con límites en Groq. Modelo abierto de OpenAI con buen razonamiento y programación; muy rápido.",
    tier: "advanced",
    strengths: ["reasoning", "code", "analysis"],
    inputPrice: 0.15,
    outputPrice: 0.6,
    contextWindow: 128_000,
    free: true,
  },
  {
    id: "groq-llama",
    provider: "groq",
    apiModel: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (Groq)",
    description: "Gratuito con límites en Groq. Respuestas casi instantáneas para consultas generales.",
    tier: "fast",
    strengths: ["general", "fast", "writing"],
    inputPrice: 0.59,
    outputPrice: 0.79,
    contextWindow: 128_000,
    free: true,
  },
  {
    id: "openrouter-free",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-chat-v3.1:free",
    label: "DeepSeek (OpenRouter, gratis)",
    description: "Modelo gratuito vía OpenRouter (los modelos «:free» tienen límites diarios y pueden registrar las peticiones).",
    tier: "advanced",
    strengths: ["code", "reasoning", "analysis"],
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 128_000,
    free: true,
  },
  // ── De pago (se activan al configurar la clave) ─────────────
  {
    id: "gemini-pro",
    provider: "google",
    apiModel: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Documentos muy largos, datos y análisis multimodal.",
    tier: "advanced",
    strengths: ["long-context", "analysis", "data", "reasoning"],
    inputPrice: 2,
    outputPrice: 12,
    contextWindow: 1_000_000,
    vision: true,
  },
  {
    id: "claude-opus",
    provider: "anthropic",
    apiModel: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Razonamiento profundo, análisis complejos, estrategia y programación exigente.",
    tier: "advanced",
    strengths: ["analysis", "code", "reasoning", "long-context", "review"],
    inputPrice: 4,
    outputPrice: 20,
    contextWindow: 1_000_000,
    vision: true,
  },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    apiModel: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Equilibrio entre velocidad y capacidad. Muy bueno en programación y redacción.",
    tier: "balanced",
    strengths: ["code", "writing", "analysis", "review"],
    inputPrice: 2,
    outputPrice: 10,
    contextWindow: 1_000_000,
    vision: true,
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
    vision: true,
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
    vision: true,
  },
  {
    id: "gpt-fast",
    provider: "openai",
    apiModel: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Modelo rápido y económico de OpenAI.",
    tier: "fast",
    strengths: ["general", "fast", "writing"],
    inputPrice: 0.4,
    outputPrice: 1.6,
    contextWindow: 400_000,
    vision: true,
  },
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Google · Gemini",
  groq: "Groq · modelos abiertos",
  openrouter: "OpenRouter · modelos gratuitos",
  anthropic: "Anthropic · Claude",
  openai: "OpenAI · GPT",
};

export const PROVIDER_ENV: Record<ProviderId, string> = {
  google: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

/** Dónde conseguir cada clave */
export const PROVIDER_SIGNUP: Record<ProviderId, { url: string; free: boolean }> = {
  google: { url: "https://aistudio.google.com/apikey", free: true },
  groq: { url: "https://console.groq.com/keys", free: true },
  openrouter: { url: "https://openrouter.ai/settings/keys", free: true },
  anthropic: { url: "https://console.anthropic.com/settings/keys", free: false },
  openai: { url: "https://platform.openai.com/api-keys", free: false },
};

export const TIER_LABELS: Record<Tier, string> = {
  fast: "Rápido",
  balanced: "Equilibrado",
  advanced: "Avanzado",
};
