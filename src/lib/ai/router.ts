import type { AiModel } from "@prisma/client";

/**
 * Selector automático de modelo.
 * Reglas explicables (se muestra el motivo al usuario) basadas en el contenido
 * de la petición. Solo elige entre modelos activos, permitidos para el rol y
 * cuyo proveedor tenga clave configurada.
 */
export interface RouteInput {
  prompt: string;
  attachmentChars: number;
  historyChars: number;
}

export interface RouteDecision {
  model: AiModel;
  reason: string;
}

const CODE_RE =
  /```|\b(c[oó]digo|programa|script|funci[oó]n|bug|error de compilaci|python|javascript|typescript|sql|api|regex|refactor|deploy|docker|clase|m[eé]todo)\b/i;
const DEEP_RE =
  /\b(analiza|an[aá]lisis|estrategia|eval[uú]a|compara|riesgo|contrato|jur[ií]dic|legal|financ|plan de negocio|due diligence|razona|demuestra|en profundidad|detallad)\w*/i;
const WRITING_RE =
  /\b(redacta|escribe|email|correo|carta|art[ií]culo|post|copy|eslogan|traduce|resume|resumen|presentaci[oó]n|discurso)\w*/i;
const DATA_RE = /\b(excel|csv|tabla|datos|hoja de c[aá]lculo|m[eé]tricas|kpi|estad[ií]stic)\w*/i;

function pick(models: AiModel[], provider: string | null, tiers: string[]): AiModel | undefined {
  for (const tier of tiers) {
    const m = models.find((x) => (provider ? x.provider === provider : true) && x.tier === tier);
    if (m) return m;
  }
  return undefined;
}

export function routeModel(input: RouteInput, available: AiModel[]): RouteDecision | null {
  if (available.length === 0) return null;
  const sorted = [...available].sort((a, b) => a.sortOrder - b.sortOrder);
  const p = input.prompt;
  const totalChars = input.attachmentChars + input.historyChars + p.length;

  const choose = (
    candidates: Array<[string | null, string[]]>,
    reason: string,
  ): RouteDecision | null => {
    for (const [provider, tiers] of candidates) {
      const m = pick(sorted, provider, tiers);
      if (m) return { model: m, reason };
    }
    return null;
  };

  // 1. Documentos o contexto muy extensos → modelo de contexto largo
  if (totalChars > 400_000) {
    const d = choose(
      [["google", ["advanced", "fast"]], ["anthropic", ["advanced", "balanced"]], [null, ["advanced", "balanced", "fast"]]],
      "Contexto muy extenso: se usa un modelo especializado en documentos largos.",
    );
    if (d) return d;
  }

  // 2. Programación
  if (CODE_RE.test(p)) {
    const d = choose(
      [["anthropic", ["balanced", "advanced"]], [null, ["balanced", "advanced"]]],
      "Tarea de programación: se usa el modelo con mejor rendimiento en código.",
    );
    if (d) return d;
  }

  // 3. Análisis profundo / razonamiento
  if (DEEP_RE.test(p) || p.length > 2500) {
    const d = choose(
      [["anthropic", ["advanced"]], [null, ["advanced"]], [null, ["balanced"]]],
      "Análisis complejo: se usa un modelo de razonamiento avanzado.",
    );
    if (d) return d;
  }

  // 4. Datos y tablas con documentos
  if (DATA_RE.test(p) && input.attachmentChars > 0) {
    const d = choose(
      [["google", ["advanced", "fast"]], [null, ["advanced", "balanced"]]],
      "Análisis de datos sobre documentos adjuntos.",
    );
    if (d) return d;
  }

  // 5. Redacción
  if (WRITING_RE.test(p)) {
    const d = choose(
      [["openai", ["advanced", "balanced"]], ["anthropic", ["balanced"]], [null, ["balanced", "advanced"]]],
      "Tarea de redacción: se usa un modelo especializado en escritura.",
    );
    if (d) return d;
  }

  // 6. Consulta breve → modelo rápido y económico
  if (p.length < 280 && input.attachmentChars === 0) {
    const d = choose([[null, ["fast"]], [null, ["balanced"]]], "Consulta breve: se usa un modelo rápido y económico.");
    if (d) return d;
  }

  // 7. Por defecto
  return (
    choose([[null, ["balanced"]], [null, ["advanced"]], [null, ["fast"]]], "Consulta general: modelo equilibrado.") ?? {
      model: sorted[0],
      reason: "Único modelo disponible.",
    }
  );
}
