import { db } from "./db";

export const SETTING_DEFAULTS = {
  cost_mode: "free_only",
  session_hours: "12",
  max_upload_mb: "4",
  allowed_extensions: "pdf,docx,xlsx,csv,txt,md,json",
  default_user_budget_usd: "50",
  global_monthly_budget_usd: "",
  rate_limit_per_minute: "20",
  max_login_failures: "5",
  system_prompt_extra: "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_LABELS: Record<SettingKey, { label: string; help: string }> = {
  cost_mode: {
    label: "Modo de coste",
    help: "free_only = solo modelos gratuitos (coste 0) · economic = prioriza gratuitos y baratos · quality = prioriza la calidad.",
  },
  session_hours: { label: "Duración de la sesión (horas)", help: "Tras este tiempo hay que volver a iniciar sesión." },
  max_upload_mb: { label: "Tamaño máximo de archivo (MB)", help: "Límite por documento. En el plan gratuito de Vercel no puede superar 4 MB (límite de 4,5 MB por petición)." },
  allowed_extensions: { label: "Extensiones permitidas", help: "Separadas por comas." },
  default_user_budget_usd: { label: "Presupuesto mensual por defecto por usuario (USD)", help: "Vacío = sin límite. Se puede ajustar por usuario." },
  global_monthly_budget_usd: { label: "Presupuesto mensual global (USD)", help: "Vacío = sin límite. Bloquea nuevas peticiones al alcanzarse." },
  rate_limit_per_minute: { label: "Peticiones por minuto y usuario", help: "Protección frente a abusos y bucles." },
  max_login_failures: { label: "Intentos de acceso fallidos antes de bloquear 15 min", help: "Por cuenta de correo." },
  system_prompt_extra: { label: "Instrucciones adicionales para todos los modelos", help: "Se añaden al mensaje de sistema (tono, contexto de empresa, etc.)." },
};

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.setting.findMany();
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export async function getSetting(key: SettingKey) {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export function num(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
