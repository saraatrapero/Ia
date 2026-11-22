import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { can, type Permission } from "../permissions";
import { getSetting, num } from "../settings";
import { SESSION_COOKIE, signSessionToken, verifySessionToken } from "./token";

export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function createSession(userId: string) {
  const hours = num(await getSetting("session_hours")) ?? 12;
  const expiresAt = new Date(Date.now() + hours * 3600_000);
  const { ip, userAgent } = await clientInfo();
  const session = await db.session.create({ data: { userId, expiresAt, ip, userAgent } });
  const token = await signSessionToken(session.id, expiresAt);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const sid = await verifySessionToken(token);
    if (sid) await db.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Usuario actual (o null). Valida firma, caducidad, revocación y que la cuenta siga activa. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sid = await verifySessionToken(token);
  if (!sid) return null;
  const session = await db.session.findUnique({
    where: { id: sid },
    include: { user: { include: { department: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Para páginas: redirige al login si no hay sesión. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!path.startsWith("/settings")) redirect("/settings?cambio=obligatorio");
  }
  return user;
}

/** Para páginas: exige un permiso o redirige al panel. */
export async function requirePermission(perm: Permission) {
  const user = await requireUser();
  if (!can(user.role, perm)) redirect("/?denegado=1");
  return user;
}

/** Para rutas API / acciones: devuelve el usuario o lanza. */
export async function apiUser(perm?: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sesión no válida o caducada.");
  if (perm && !can(user.role, perm)) throw new HttpError(403, "No tienes permiso para esta acción.");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Error interno del servidor." }, { status: 500 });
}
