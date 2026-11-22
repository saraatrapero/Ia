import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function dailySeries(where: Prisma.UsageRecordWhereInput, from: Date, to: Date) {
  const rows = await db.usageRecord.findMany({
    where: { ...where, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, costUsd: true, status: true },
  });
  const map = new Map<string, { value: number; calls: number }>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) map.set(d.toISOString().slice(0, 10), { value: 0, calls: 0 });
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    const e = map.get(k);
    if (e) {
      e.value += r.costUsd;
      e.calls += 1;
    }
  }
  return [...map.entries()].map(([day, v]) => ({ day, ...v }));
}

export async function byModel(where: Prisma.UsageRecordWhereInput) {
  const groups = await db.usageRecord.groupBy({
    by: ["modelId", "provider"],
    where,
    _sum: { costUsd: true, inputTokens: true, outputTokens: true, latencyMs: true },
    _count: { _all: true },
    orderBy: { _sum: { costUsd: "desc" } },
  });
  const errors = await db.usageRecord.groupBy({ by: ["modelId"], where: { ...where, status: "error" }, _count: { _all: true } });
  const models = await db.aiModel.findMany({ select: { id: true, label: true } });
  const label = new Map(models.map((m) => [m.id, m.label]));
  const errMap = new Map(errors.map((e) => [e.modelId, e._count._all]));
  return groups.map((g) => ({
    modelId: g.modelId,
    label: label.get(g.modelId) ?? g.modelId,
    provider: g.provider,
    calls: g._count._all,
    errors: errMap.get(g.modelId) ?? 0,
    cost: g._sum.costUsd ?? 0,
    inputTokens: g._sum.inputTokens ?? 0,
    outputTokens: g._sum.outputTokens ?? 0,
    avgLatency: g._count._all ? Math.round((g._sum.latencyMs ?? 0) / g._count._all) : 0,
  }));
}

export async function byUser(where: Prisma.UsageRecordWhereInput) {
  const groups = await db.usageRecord.groupBy({
    by: ["userId"],
    where,
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    _count: { _all: true },
    orderBy: { _sum: { costUsd: "desc" } },
  });
  const users = await db.user.findMany({
    where: { id: { in: groups.map((g) => g.userId) } },
    select: { id: true, name: true, email: true, monthlyBudgetUsd: true, department: { select: { name: true } } },
  });
  const u = new Map(users.map((x) => [x.id, x]));
  return groups.map((g) => ({
    userId: g.userId,
    name: u.get(g.userId)?.name ?? "—",
    email: u.get(g.userId)?.email ?? "",
    department: u.get(g.userId)?.department?.name ?? "—",
    calls: g._count._all,
    cost: g._sum.costUsd ?? 0,
    tokens: (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0),
  }));
}
