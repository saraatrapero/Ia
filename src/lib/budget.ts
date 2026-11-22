import { db } from "./db";
import { getSettings, num } from "./settings";

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function monthSpend(userId?: string) {
  const agg = await db.usageRecord.aggregate({
    _sum: { costUsd: true },
    where: { createdAt: { gte: monthStart() }, ...(userId ? { userId } : {}) },
  });
  return agg._sum.costUsd ?? 0;
}

/** Devuelve un mensaje de bloqueo si se ha superado algún presupuesto, o null. */
export async function checkBudget(user: { id: string; monthlyBudgetUsd: number | null }) {
  const s = await getSettings();
  const global = num(s.global_monthly_budget_usd);
  if (global !== null && (await monthSpend()) >= global)
    return "Se ha alcanzado el presupuesto mensual global de la organización. Contacta con el administrador.";
  const own = user.monthlyBudgetUsd ?? num(s.default_user_budget_usd);
  if (own !== null && (await monthSpend(user.id)) >= own)
    return `Has alcanzado tu presupuesto mensual (${own} USD). Contacta con el administrador para ampliarlo.`;
  return null;
}
