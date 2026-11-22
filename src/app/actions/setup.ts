"use server";

import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureCatalog } from "@/lib/ai/ensure-catalog";
import { audit } from "@/lib/audit";
import { clientInfo, createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { passwordProblem, type FormState } from "./auth";

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Crea el primer administrador. Solo funciona mientras no exista ningún usuario. */
export async function setupAction(_p: FormState, form: FormData): Promise<FormState> {
  const expected = process.env.SETUP_CODE ?? "";
  if (expected.length < 8) return { error: "Falta la variable SETUP_CODE (mínimo 8 caracteres) en la configuración del servidor." };
  if ((await db.user.count()) > 0) return { error: "La plataforma ya está configurada. Inicia sesión." };

  const parsed = z
    .object({
      code: z.string(),
      name: z.string().trim().min(2, "Nombre demasiado corto").max(80),
      email: z.string().trim().toLowerCase().email("Correo no válido"),
      password: z.string(),
      confirm: z.string(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  if (!sameSecret(d.code, expected)) return { error: "El código de instalación no es correcto." };
  const problem = await passwordProblem(d.password);
  if (problem) return { error: problem };
  if (d.password !== d.confirm) return { error: "Las contraseñas no coinciden." };

  await ensureCatalog();
  const user = await db.user.create({
    data: { name: d.name, email: d.email, role: "ADMIN", passwordHash: await bcrypt.hash(d.password, 12) },
  });
  await audit(user.id, "user.created", { details: { email: d.email, role: "ADMIN", via: "setup" }, ip: (await clientInfo()).ip });
  await createSession(user.id);
  redirect("/");
}
