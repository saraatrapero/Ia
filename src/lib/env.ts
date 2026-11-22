/**
 * Resolución de configuración con valores alternativos.
 * Permite usar las variables que crea automáticamente la integración de Supabase en Vercel
 * (POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY…)
 * sin tener que copiarlas a mano. Compatible con el runtime Edge.
 */
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export function databaseUrl() {
  return env("DATABASE_URL") ?? env("POSTGRES_PRISMA_URL") ?? env("POSTGRES_URL");
}

export function directUrl() {
  return env("DIRECT_URL") ?? env("POSTGRES_URL_NON_POOLING") ?? databaseUrl();
}

export function supabaseUrl() {
  return env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseServiceKey() {
  return env("SUPABASE_SERVICE_ROLE_KEY") ?? env("SUPABASE_SECRET_KEY");
}

/** local | supabase. Si no se indica, se usa Supabase cuando hay credenciales. */
export function storageDriver(): "local" | "supabase" {
  const v = env("STORAGE_DRIVER")?.toLowerCase();
  if (v === "local" || v === "supabase") return v;
  return supabaseUrl() && supabaseServiceKey() ? "supabase" : "local";
}

/**
 * Material para firmar sesiones. Si no hay AUTH_SECRET se deriva (SHA-256 con etiqueta propia)
 * de un secreto de servidor ya existente, de modo que no hace falta configurar uno a mano.
 */
export function authSecretMaterial(): string | null {
  const explicit = env("AUTH_SECRET");
  if (explicit && explicit.length >= 32) return explicit;
  const base = env("SUPABASE_JWT_SECRET") ?? supabaseServiceKey();
  return base && base.length >= 32 ? `trapero-ai/session/v1:${base}` : null;
}

/** Problemas de configuración que impiden arrancar, explicados para la persona que instala. */
export function configProblems(): string[] {
  const p: string[] = [];
  if (!databaseUrl()) p.push("Falta la base de datos: en Vercel, abre tu proyecto → Storage → conecta Supabase, y vuelve a desplegar.");
  if (!authSecretMaterial()) p.push("Falta el secreto de sesión: conecta Supabase (se usa su clave) o añade la variable AUTH_SECRET con al menos 32 caracteres.");
  if (env("VERCEL") && storageDriver() === "local")
    p.push("Falta el almacenamiento de archivos: conecta Supabase en Vercel → Storage (Vercel no guarda archivos en disco).");
  if (!env("SETUP_CODE") || env("SETUP_CODE")!.length < 8)
    p.push("Falta SETUP_CODE (mínimo 8 caracteres): el código que se pedirá para crear la cuenta de administrador.");
  return p;
}
