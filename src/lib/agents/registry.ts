/**
 * Estructura de agentes de TRAPERO AI.
 *
 * POLÍTICA ACTUAL: la ejecución autónoma está DESACTIVADA. Los agentes se pueden
 * definir, revisar y programar, pero el ejecutor rechaza cualquier ejecución
 * hasta que se active explícitamente cambiando AGENT_EXECUTION_ENABLED y se
 * complete la revisión de seguridad. Ninguna herramienta tiene acceso
 * ilimitado a sistemas reales.
 */
export const AGENT_EXECUTION_ENABLED = false;

export type PermissionLevel = "read" | "draft" | "execute";

export const PERMISSION_LEVELS: Record<PermissionLevel, { label: string; description: string; available: boolean }> = {
  read: {
    label: "Solo lectura",
    description: "Puede leer documentos y datos autorizados y producir análisis. No modifica nada.",
    available: true,
  },
  draft: {
    label: "Borrador con aprobación",
    description: "Prepara borradores (correos, documentos, cambios) que una persona debe aprobar antes de aplicarse.",
    available: true,
  },
  execute: {
    label: "Ejecución",
    description: "Actúa directamente sobre sistemas externos. Bloqueado en esta fase.",
    available: false,
  },
};

export interface AgentTool {
  id: string;
  label: string;
  description: string;
  /** Nivel mínimo de permiso del agente para poder usar la herramienta */
  requires: PermissionLevel;
  /** Si la herramienta toca sistemas externos */
  external: boolean;
}

export const AGENT_TOOLS: AgentTool[] = [
  { id: "documents.read", label: "Leer documentos", description: "Acceso de lectura a los documentos subidos por el propietario del agente.", requires: "read", external: false },
  { id: "conversations.read", label: "Leer conversaciones", description: "Acceso de lectura al historial del propietario.", requires: "read", external: false },
  { id: "files.generate", label: "Generar archivos", description: "Crear documentos descargables (Word, Excel, Markdown).", requires: "draft", external: false },
  { id: "email.draft", label: "Borradores de correo", description: "Preparar correos para revisión humana. No envía.", requires: "draft", external: false },
  { id: "web.search", label: "Búsqueda web", description: "Consultar información pública en internet.", requires: "read", external: true },
  { id: "email.send", label: "Enviar correo", description: "Enviar correos en nombre del usuario.", requires: "execute", external: true },
  { id: "api.call", label: "Llamadas a APIs externas", description: "Invocar sistemas de terceros.", requires: "execute", external: true },
];

const RANK: Record<PermissionLevel, number> = { read: 0, draft: 1, execute: 2 };

export function toolAllowed(level: PermissionLevel, toolId: string) {
  const t = AGENT_TOOLS.find((x) => x.id === toolId);
  return Boolean(t && RANK[level] >= RANK[t.requires] && PERMISSION_LEVELS[t.requires].available);
}

/** Punto de entrada único del ejecutor. Hoy siempre bloquea. */
export function canRunAgent(): { ok: false; reason: string } | { ok: true } {
  if (!AGENT_EXECUTION_ENABLED) {
    return { ok: false, reason: "La ejecución de agentes está desactivada en esta fase. Solo se permite definirlos y programarlos." };
  }
  return { ok: true };
}

/** Validación sencilla de expresiones cron de 5 campos. */
export function isValidCron(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((p) => /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/.test(p));
}
