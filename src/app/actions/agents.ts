"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_TOOLS, isValidCron, PERMISSION_LEVELS, toolAllowed, type PermissionLevel } from "@/lib/agents/registry";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { FormState } from "./auth";

export async function createAgentAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await apiUser("agents.manage").catch(() => null);
  if (!user) return { error: "No tienes permiso." };
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300),
      systemPrompt: z.string().trim().min(5).max(10_000),
      modelId: z.string().min(1),
      permissionLevel: z.enum(["read", "draft", "execute"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisa los campos: nombre, instrucciones y modelo son obligatorios." };
  const d = parsed.data;
  if (!PERMISSION_LEVELS[d.permissionLevel as PermissionLevel].available)
    return { error: "El nivel «Ejecución» está bloqueado en esta fase." };
  const tools = form.getAll("tools").map(String).filter((t) => toolAllowed(d.permissionLevel as PermissionLevel, t));
  if (!(await db.aiModel.findUnique({ where: { id: d.modelId } }))) return { error: "Modelo no válido." };
  const agent = await db.agent.create({ data: { ...d, tools: tools.join(","), createdById: user.id, enabled: false } });
  await audit(user.id, "agent.created", { target: agent.id, details: { name: d.name, level: d.permissionLevel, tools } });
  revalidatePath("/agents");
  return { ok: "Agente creado (desactivado)." };
}

export async function createScheduleAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await apiUser("agents.manage").catch(() => null);
  if (!user) return { error: "No tienes permiso." };
  const agentId = String(form.get("agentId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const cron = String(form.get("cron") ?? "").trim();
  const prompt = String(form.get("prompt") ?? "").trim();
  if (!name || !prompt) return { error: "Nombre e instrucción son obligatorios." };
  if (!isValidCron(cron)) return { error: "Expresión cron no válida (5 campos, p. ej. «0 8 * * 1-5»)." };
  if (!(await db.agent.findUnique({ where: { id: agentId } }))) return { error: "Agente no encontrado." };
  await db.scheduledTask.create({ data: { agentId, name, cron, prompt, enabled: false } });
  await audit(user.id, "agent.updated", { target: agentId, details: { schedule: name, cron } });
  revalidatePath("/agents");
  return { ok: "Programación guardada (inactiva hasta habilitar la ejecución)." };
}

