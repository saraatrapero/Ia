"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { apiUser, clientInfo } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/permissions";
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { passwordProblem, type FormState } from "./auth";

async function admin(perm: "users.manage" | "models.manage" | "security.manage") {
  return apiUser(perm).catch(() => null);
}

function tempPassword() {
  return randomBytes(9).toString("base64url") + "7a";
}

const budgetField = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? Number(v.replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Presupuesto no válido");

export async function createUserAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("users.manage");
  if (!me) return { error: "No tienes permiso." };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nombre demasiado corto").max(80),
      email: z.string().trim().toLowerCase().email("Correo no válido"),
      role: z.enum(ROLES),
      departmentId: z.string().optional(),
      monthlyBudgetUsd: budgetField,
      password: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "Ya existe un usuario con ese correo." };

  const generated = !d.password;
  const password = d.password || tempPassword();
  const problem = await passwordProblem(password);
  if (problem) return { error: problem };

  const user = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      role: d.role,
      departmentId: d.departmentId || null,
      monthlyBudgetUsd: d.monthlyBudgetUsd,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  await audit(me.id, "user.created", { target: user.id, details: { email: d.email, role: d.role }, ip: (await clientInfo()).ip });
  revalidatePath("/admin/users");
  return {
    ok: generated
      ? `Usuario creado. Contraseña temporal: ${password} — compártela por un canal seguro; se pedirá cambiarla en el primer acceso.`
      : "Usuario creado. Deberá cambiar la contraseña en su primer acceso.",
  };
}

export async function updateUserAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("users.manage");
  if (!me) return { error: "No tienes permiso." };
  const parsed = z
    .object({
      id: z.string(),
      role: z.enum(ROLES),
      departmentId: z.string().optional(),
      monthlyBudgetUsd: budgetField,
      active: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  const active = d.active === "on";
  if (d.id === me.id && (d.role !== "ADMIN" || !active)) return { error: "No puedes quitarte el rol de administrador ni desactivarte a ti mismo." };
  await db.user.update({
    where: { id: d.id },
    data: { role: d.role, departmentId: d.departmentId || null, monthlyBudgetUsd: d.monthlyBudgetUsd, active },
  });
  if (!active) await db.session.updateMany({ where: { userId: d.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(me.id, "user.updated", { target: d.id, details: { role: d.role, active, budget: d.monthlyBudgetUsd } });
  revalidatePath("/admin/users");
  return { ok: "Cambios guardados." };
}

export async function resetPasswordAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("users.manage");
  if (!me) return { error: "No tienes permiso." };
  const id = String(form.get("id"));
  const password = tempPassword();
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(me.id, "user.password_reset", { target: id });
  revalidatePath("/admin/users");
  return { ok: `Nueva contraseña temporal: ${password}` };
}

export async function revokeSessionsAction(form: FormData) {
  const me = await admin("users.manage");
  if (!me) return;
  const id = String(form.get("id"));
  await db.session.updateMany({ where: { userId: id, revokedAt: null, NOT: { userId: me.id } }, data: { revokedAt: new Date() } });
  await audit(me.id, "user.sessions_revoked", { target: id });
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
}

export async function createDepartmentAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("users.manage");
  if (!me) return { error: "No tienes permiso." };
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Nombre demasiado corto." };
  if (await db.department.findUnique({ where: { name } })) return { error: "Ya existe ese departamento." };
  await db.department.create({ data: { name } });
  await audit(me.id, "department.created", { details: { name } });
  revalidatePath("/admin/users");
  return { ok: `Departamento «${name}» creado.` };
}

export async function updateModelAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("models.manage");
  if (!me) return { error: "No tienes permiso." };
  const parsed = z
    .object({
      id: z.string(),
      label: z.string().trim().min(1).max(60),
      apiModel: z.string().trim().min(1).max(100).regex(/^[\w.\-:@/]+$/, "Identificador de API no válido"),
      tier: z.enum(["fast", "balanced", "advanced"]),
      inputPrice: z.coerce.number().min(0),
      outputPrice: z.coerce.number().min(0),
      minRole: z.enum(ROLES),
      enabled: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, enabled, ...rest } = parsed.data;
  await db.aiModel.update({ where: { id }, data: { ...rest, enabled: enabled === "on" } });
  await audit(me.id, "model.updated", { target: id, details: { ...rest, enabled: enabled === "on" } });
  revalidatePath("/admin/models");
  return { ok: "Modelo actualizado." };
}

export async function updateSettingsAction(_p: FormState, form: FormData): Promise<FormState> {
  const me = await admin("security.manage");
  if (!me) return { error: "No tienes permiso." };
  const numeric: SettingKey[] = ["session_hours", "max_upload_mb", "rate_limit_per_minute", "max_login_failures"];
  const changes: Record<string, string> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const raw = form.get(key);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (numeric.includes(key) && !(Number(value) > 0)) return { error: `Valor no válido para ${key}.` };
    if ((key === "default_user_budget_usd" || key === "global_monthly_budget_usd") && value !== "" && !(Number(value.replace(",", ".")) >= 0))
      return { error: "Presupuesto no válido." };
    if (key === "allowed_extensions") {
      const allowed = ["pdf", "docx", "xlsx", "csv", "txt", "md", "json"];
      const list = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (list.some((e) => !allowed.includes(e))) return { error: `Extensiones soportadas: ${allowed.join(", ")}.` };
    }
    changes[key] = value;
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await audit(me.id, "settings.updated", { details: changes });
  revalidatePath("/admin/security");
  return { ok: "Configuración guardada." };
}
