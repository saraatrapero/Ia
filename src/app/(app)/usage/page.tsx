import { DailyBars } from "@/components/charts/daily-bars";
import { ModelBars } from "@/components/charts/model-bars";
import { Page, PageHeader, Stat } from "@/components/page-header";
import { ProviderDot } from "@/components/provider-dot";
import { formatTokens, formatUsd } from "@/lib/ai/pricing";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSettings, num } from "@/lib/settings";
import { byModel, byUser, dailySeries } from "@/lib/usage";

export const metadata = { title: "Consumo y costes" };

const RANGES: Record<string, { label: string; days: number }> = {
  "7": { label: "7 días", days: 7 },
  "30": { label: "30 días", days: 30 },
  "90": { label: "90 días", days: 90 },
  mes: { label: "Este mes", days: 0 },
};

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ rango?: string; ambito?: string }> }) {
  const user = await requirePermission("usage.view_own");
  const sp = await searchParams;
  const rango = sp.rango && RANGES[sp.rango] ? sp.rango : "30";
  const canAll = can(user.role, "usage.view_all");
  const ambito = canAll && sp.ambito === "yo" ? "yo" : canAll ? "org" : "yo";

  const to = new Date();
  const from = new Date();
  if (rango === "mes") from.setDate(1);
  else from.setDate(from.getDate() - (RANGES[rango].days - 1));
  from.setHours(0, 0, 0, 0);

  const scope = ambito === "org" ? {} : { userId: user.id };
  const where = { ...scope, createdAt: { gte: from, lte: to } };
  const settings = await getSettings();

  const [totals, errors, series, models, users, recent] = await Promise.all([
    db.usageRecord.aggregate({ where, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: { _all: true }, _avg: { latencyMs: true } }),
    db.usageRecord.count({ where: { ...where, status: "error" } }),
    dailySeries(scope, from, to),
    byModel(where),
    ambito === "org" ? byUser(where) : Promise.resolve([]),
    db.usageRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { name: true } } } }),
  ]);
  const labels = new Map((await db.aiModel.findMany({ select: { id: true, label: true } })).map((m) => [m.id, m.label]));
  const total = totals._sum.costUsd ?? 0;
  const calls = totals._count._all;
  const defaultBudget = num(settings.default_user_budget_usd);

  // Proyección a fin de mes basada en el ritmo del mes en curso
  const monthStart = new Date(to.getFullYear(), to.getMonth(), 1);
  const monthAgg = await db.usageRecord.aggregate({ where: { ...scope, createdAt: { gte: monthStart } }, _sum: { costUsd: true } });
  const dayOfMonth = to.getDate();
  const daysInMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  const projection = ((monthAgg._sum.costUsd ?? 0) / dayOfMonth) * daysInMonth;

  const link = (params: Record<string, string>) => {
    const p = new URLSearchParams({ rango, ...(canAll ? { ambito } : {}), ...params });
    return `/usage?${p.toString()}`;
  };

  return (
    <Page>
      <PageHeader
        title="Consumo y costes"
        subtitle={ambito === "org" ? "Toda la organización" : "Tu consumo personal"}
        actions={
          <div className="flex flex-wrap gap-2">
            {canAll && (
              <div className="flex rounded-lg border border-line-strong p-0.5 text-sm">
                {[["org", "Organización"], ["yo", "Solo yo"]].map(([k, l]) => (
                  <a key={k} href={link({ ambito: k })} className={`rounded-md px-3 py-1.5 ${ambito === k ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}>{l}</a>
                ))}
              </div>
            )}
            <div className="flex rounded-lg border border-line-strong p-0.5 text-sm">
              {Object.entries(RANGES).map(([k, r]) => (
                <a key={k} href={link({ rango: k })} className={`rounded-md px-3 py-1.5 ${rango === k ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}>{r.label}</a>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Coste" value={formatUsd(total)} hint={RANGES[rango].label} />
        <Stat label="Peticiones" value={calls.toLocaleString("es-ES")} hint={calls ? `${formatUsd(total / calls)} de media` : undefined} />
        <Stat label="Tokens" value={formatTokens((totals._sum.inputTokens ?? 0) + (totals._sum.outputTokens ?? 0))} hint={`${formatTokens(totals._sum.inputTokens ?? 0)} entrada · ${formatTokens(totals._sum.outputTokens ?? 0)} salida`} />
        <Stat label="Errores" value={String(errors)} hint={calls ? `${((errors / calls) * 100).toFixed(1)} % · latencia media ${((totals._avg.latencyMs ?? 0) / 1000).toFixed(1)} s` : undefined} tone={errors > 0 ? "warn" : undefined} />
        <Stat label="Proyección del mes" value={formatUsd(projection)} hint="Al ritmo actual" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-4 font-medium">Coste diario</h2>
          <DailyBars data={series} label="USD por día" />
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium">Por modelo</h2>
          <ModelBars format={formatUsd} rows={models.map((m) => ({ label: m.label, provider: m.provider, value: m.cost, sub: `${m.calls} pet.` }))} />
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-medium">Detalle por modelo</h2>
        <table className="table mt-3">
          <thead>
            <tr><th>Modelo</th><th className="text-right">Peticiones</th><th className="text-right">Errores</th><th className="text-right">Tokens entrada</th><th className="text-right">Tokens salida</th><th className="text-right">Latencia media</th><th className="text-right">Coste</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {models.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">Sin datos en el periodo.</td></tr>}
            {models.map((m) => (
              <tr key={m.modelId}>
                <td><span className="flex items-center gap-2"><ProviderDot provider={m.provider} />{m.label}</span></td>
                <td className="text-right">{m.calls}</td>
                <td className="text-right">{m.errors}</td>
                <td className="text-right">{formatTokens(m.inputTokens)}</td>
                <td className="text-right">{formatTokens(m.outputTokens)}</td>
                <td className="text-right">{(m.avgLatency / 1000).toFixed(1)} s</td>
                <td className="text-right font-medium">{formatUsd(m.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {ambito === "org" && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="px-5 pt-5 font-medium">Por usuario</h2>
          <table className="table mt-3">
            <thead><tr><th>Usuario</th><th>Departamento</th><th className="text-right">Peticiones</th><th className="text-right">Tokens</th><th className="text-right">Coste</th></tr></thead>
            <tbody className="tabular-nums">
              {users.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Sin datos en el periodo.</td></tr>}
              {users.map((u) => (
                <tr key={u.userId}>
                  <td>{u.name}<div className="text-xs text-muted">{u.email}</div></td>
                  <td>{u.department}</td>
                  <td className="text-right">{u.calls}</td>
                  <td className="text-right">{formatTokens(u.tokens)}</td>
                  <td className="text-right font-medium">{formatUsd(u.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card mt-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-medium">Últimas peticiones</h2>
        <table className="table mt-3">
          <thead><tr><th>Fecha</th>{ambito === "org" && <th>Usuario</th>}<th>Modelo</th><th>Estado</th><th className="text-right">Tokens</th><th className="text-right">Coste</th></tr></thead>
          <tbody className="tabular-nums">
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{r.createdAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</td>
                {ambito === "org" && <td>{r.user.name}</td>}
                <td><span className="flex items-center gap-2"><ProviderDot provider={r.provider} />{labels.get(r.modelId) ?? r.modelId}</span></td>
                <td>{r.status === "ok" ? <span className="text-ok">Correcta</span> : <span className="text-bad" title={r.error ?? ""}>Error</span>}</td>
                <td className="text-right">{(r.inputTokens + r.outputTokens).toLocaleString("es-ES")}</td>
                <td className="text-right">{formatUsd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs text-muted">
        Costes estimados con los precios configurados en Administración → Modelos.{defaultBudget ? ` Presupuesto mensual por defecto: ${formatUsd(defaultBudget)} por usuario.` : ""}
      </p>
    </Page>
  );
}
