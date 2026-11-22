"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { clientInfo, createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSetting, num } from "@/lib/settings";

const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Y8rQzZ5v6Yk3Q8z4rV8m5d0c1lP9eW";

export type FormState = { error?: string; ok?: string } | undefined;

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Introduce un correo y una contraseña válidos." };
  const { email, password } = parsed.data;
  const { ip } = await clientInfo();

  const maxFailures = num(await getSetting("max_login_failures")) ?? 5;
  const since = new Date(Date.now() - 15 * 60_000);
  const failures = await db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } });
  if (failures >= maxFailures) {
    return { error: "Demasiados intentos fallidos. La cuenta está bloqueada temporalmente (15 minutos)." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await db.loginAttempt.create({ data: { email, ip, success: false } });
    await audit(user?.id ?? null, "auth.login_failed", { details: { email }, ip });
    return { error: user && ok && !user.active ? "Esta cuenta está desactivada." : "Correo o contraseña incorrectos." };
  }

  await db.loginAttempt.create({ data: { email, ip, success: true } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit(user.id, "auth.login", { ip });
  redirect(user.mustChangePassword ? "/settings?cambio=obligatorio" : "/");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout");
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "La contraseña actual no es correcta." };
  const problem = await passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "Las contraseñas nuevas no coinciden." };
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false },
  });
  await audit(user.id, "auth.password_changed");
  return { ok: "Contraseña actualizada." };
}

export async function passwordProblem(pw: string) {
  if (pw.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "La contraseña debe combinar letras y números.";
  return null;
}
