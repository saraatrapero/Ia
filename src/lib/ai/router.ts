/**
 * Selector inteligente de modelos.
 *
 * 1. Clasifica la petición (programación, análisis, redacción, datos, documento largo, consulta breve, general).
 * 2. Descarta los modelos cuyo contexto no admite el tamaño de la conversación.
 * 3. Puntúa cada candidato según sus capacidades, categoría, proveedor preferente y coste.
 * El motivo de la elección se muestra al usuario.
 *
 * No depende de la base de datos: recibe los modelos disponibles (ya filtrados por rol,
 * claves configuradas y modo de coste), lo que permite probarlo de forma aislada.
 */

export type CostMode = "free_only" | "economic" | "quality";

export interface RoutableModel {
  id: string;
  provider: string;
  label: string;
  tier: string;
  strengths: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  free: boolean;
  sortOrder: number;
}

export interface RouteInput {
  prompt: string;
  attachmentChars: number;
  historyChars: number;
}

export type TaskType = "long" | "code" | "deep" | "data" | "writing" | "quick" | "general";

interface TaskProfile {
  label: string;
  strengths: string[];
  tiers: string[];
  providers: string[];
}

const TASKS: Record<TaskType, TaskProfile> = {
  long: { label: "Documentación muy extensa", strengths: ["long-context"], tiers: ["advanced", "balanced", "fast"], providers: ["google", "anthropic", "openai"] },
  code: { label: "Programación", strengths: ["code"], tiers: ["balanced", "advanced"], providers: ["anthropic", "openai", "groq", "openrouter", "google"] },
  deep: { label: "Análisis complejo", strengths: ["reasoning", "analysis"], tiers: ["advanced", "balanced"], providers: ["anthropic", "openai", "google", "groq", "openrouter"] },
  data: { label: "Análisis de datos y documentos", strengths: ["data", "long-context", "analysis"], tiers: ["advanced", "balanced"], providers: ["google", "anthropic", "openai", "groq"] },
  writing: { label: "Redacción", strengths: ["writing"], tiers: ["balanced", "advanced", "fast"], providers: ["openai", "anthropic", "google", "groq", "openrouter"] },
  quick: { label: "Consulta breve", strengths: ["fast", "general"], tiers: ["fast", "balanced"], providers: [] },
  general: { label: "Consulta general", strengths: ["general"], tiers: ["balanced", "advanced", "fast"], providers: [] },
};

const CODE_RE =
  /```|\b(c[oó]digo|programa(r|ci[oó]n)?|script|funci[oó]n|bug|depura|compila|python|javascript|typescript|java|sql|html|css|api|regex|refactoriza|deploy|docker|endpoint|backend|frontend|base de datos|consulta sql)\b/i;
const DEEP_RE =
  /\b(analiza|an[aá]lisis|estrategia|eval[uú]a|compara|riesgos?|contrato|jur[ií]dic\w*|legal|financier\w*|inversi[oó]n|rentabilidad|plan de negocio|due diligence|razona|demuestra|en profundidad|detallad\w*|auditor[ií]a|diagn[oó]stico)\b/i;
const WRITING_RE =
  /\b(redacta|escribe|email|correo|carta|art[ií]culo|post|copy|eslogan|traduce|resume|resumen|presentaci[oó]n|discurso|propuesta|informe)\b/i;
const DATA_RE = /\b(excel|csv|tabla|datos|hoja de c[aá]lculo|m[eé]tricas|kpi|estad[ií]stic\w*|gr[aá]fico)\b/i;

/** Estimación prudente de tokens a partir de caracteres (español ≈ 3,5 caracteres/token). */
export function estimateTokens(chars: number) {
  return Math.ceil(chars / 3.5);
}

export function classify(input: RouteInput): TaskType {
  const p = input.prompt;
  const total = input.attachmentChars + input.historyChars + p.length;
  if (total > 400_000) return "long";
  if (CODE_RE.test(p)) return "code";
  if (DEEP_RE.test(p) || p.length > 2500) return "deep";
  if (DATA_RE.test(p) && input.attachmentChars > 0) return "data";
  if (input.attachmentChars > 0) return "data";
  if (WRITING_RE.test(p)) return "writing";
  if (p.length < 280) return "quick";
  return "general";
}

function avgPrice(m: RoutableModel) {
  return m.free ? 0 : (m.inputPrice + m.outputPrice * 3) / 4;
}

export function scoreModel(m: RoutableModel, task: TaskType, mode: CostMode) {
  const t = TASKS[task];
  const strengths = m.strengths.split(",").map((s) => s.trim());
  let score = Math.min(3, t.strengths.filter((s) => strengths.includes(s)).length) * 10;
  const ti = t.tiers.indexOf(m.tier);
  if (ti !== -1) score += (t.tiers.length - ti) * 8;
  const pi = t.providers.indexOf(m.provider);
  if (pi !== -1) score += (t.providers.length - pi) * 3;
  if (mode === "economic") score += m.free ? 25 : -Math.min(avgPrice(m), 20) * 2;
  if (mode === "quality" && m.tier === "advanced" && task !== "quick") score += 6;
  return score;
}

export interface RouteDecision<M extends RoutableModel> {
  model: M;
  task: TaskType;
  reason: string;
}

export function routeModel<M extends RoutableModel>(input: RouteInput, available: M[], mode: CostMode): RouteDecision<M> | null {
  if (available.length === 0) return null;
  const task = classify(input);
  const needed = estimateTokens(input.attachmentChars + input.historyChars + input.prompt.length) + 4000;
  const fitting = available.filter((m) => m.contextWindow >= needed);
  const pool = fitting.length > 0 ? fitting : available;

  const ranked = [...pool].sort((a, b) => scoreModel(b, task, mode) - scoreModel(a, task, mode) || a.sortOrder - b.sortOrder);
  const model = ranked[0];
  const parts = [`${TASKS[task].label}`];
  if (fitting.length < available.length) parts.push(`se descartan modelos sin contexto para ~${Math.round(needed / 1000)}k tokens`);
  if (mode === "free_only") parts.push("solo modelos gratuitos");
  else if (mode === "economic") parts.push(model.free ? "opción gratuita priorizada" : "opción más económica adecuada");
  if (fitting.length === 0) parts.push("aviso: la conversación puede superar el contexto del modelo");
  return { model, task, reason: parts.join(" · ") };
}

/** Ordena los candidatos para conmutar si el elegido falla: otro proveedor y, si es posible, misma categoría. */
export function fallbackOrder<M extends RoutableModel>(failed: M, available: M[], tried: Set<string>): M[] {
  // Primero otros proveedores; después otros modelos del mismo proveedor (cupos y saturación suelen ser por modelo)
  return available
    .filter((m) => !tried.has(m.id))
    .sort(
      (a, b) =>
        Number(b.provider !== failed.provider) - Number(a.provider !== failed.provider) ||
        Number(b.tier === failed.tier) - Number(a.tier === failed.tier) ||
        avgPrice(a) - avgPrice(b) ||
        a.sortOrder - b.sortOrder,
    );
}

/** Elige un revisor de otro proveedor para la «segunda opinión». */
export function pickReviewer<M extends RoutableModel>(authorProvider: string, available: M[]): M | null {
  const others = available.filter((m) => m.provider !== authorProvider);
  const pool = others.length ? others : available;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => scoreModel(b, "deep", "quality") + (b.strengths.includes("review") ? 10 : 0) - (scoreModel(a, "deep", "quality") + (a.strengths.includes("review") ? 10 : 0)) || a.sortOrder - b.sortOrder)[0];
}

/** Elige modelos de proveedores distintos para una comparación automática. */
export function pickForComparison<M extends RoutableModel>(input: RouteInput, available: M[], mode: CostMode, count = 3): M[] {
  const task = classify(input);
  const ranked = [...available].sort((a, b) => scoreModel(b, task, mode) - scoreModel(a, task, mode) || a.sortOrder - b.sortOrder);
  const out: M[] = [];
  for (const m of ranked) if (!out.some((x) => x.provider === m.provider)) out.push(m);
  for (const m of ranked) if (out.length < Math.min(count, available.length) && !out.includes(m)) out.push(m);
  return out.slice(0, count);
}
