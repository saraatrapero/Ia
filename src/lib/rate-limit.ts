import { db } from "./db";

/**
 * Límite de peticiones por usuario y minuto, calculado en la base de datos para que
 * funcione igual con varias instancias o funciones serverless (Vercel).
 */
export async function withinRateLimit(userId: string, perMinute: number) {
  const since = new Date(Date.now() - 60_000);
  const recent = await db.usageRecord.count({ where: { userId, createdAt: { gte: since } } });
  return recent < perMinute;
}

/** Límite de subidas: documentos subidos en el último minuto. */
export async function withinUploadLimit(userId: string, perMinute = 30) {
  const since = new Date(Date.now() - 60_000);
  const recent = await db.attachment.count({ where: { userId, createdAt: { gte: since } } });
  return recent < perMinute;
}
