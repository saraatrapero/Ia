/**
 * Compilación para producción (Vercel).
 * 1. Traduce las variables de la integración Supabase-Vercel a las que usa Prisma.
 * 2. Crea/actualiza las tablas si hay base de datos (si no, compila igualmente y la web
 *    mostrará qué falta configurar).
 * 3. Compila Next.js.
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env };
const pick = (...keys) => keys.map((k) => env[k]).find((v) => v && v.trim() !== "");

env.DATABASE_URL = pick("DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL") ?? "";
env.DIRECT_URL = pick("DIRECT_URL", "POSTGRES_URL_NON_POOLING") ?? env.DATABASE_URL;

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["prisma", "generate"]);
if (env.DATABASE_URL) {
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
} else {
  console.warn("\n⚠ No hay base de datos conectada: se omite la creación de tablas. Conecta Supabase en Vercel → Storage y vuelve a desplegar.");
  // Prisma exige que las variables existan al compilar; valores vacíos inofensivos
  env.DATABASE_URL = "postgresql://sin-configurar@localhost:5432/sin-configurar";
  env.DIRECT_URL = env.DATABASE_URL;
}
run("npx", ["next", "build"]);
