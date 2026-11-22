import Link from "next/link";
import { ModelBars } from "@/components/charts/model-bars";
import { DailyBars } from "@/components/charts/daily-bars";
import { IconBot, IconChat, IconFile, IconSearch } from "@/components/icons";
import { Page, PageHeader, Stat } from "@/components/page-header";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/ai/catalog";
import { formatTokens, formatUsd } from "@/lib/ai/pricing";
import { providerStatus } from "@/lib/ai/providers";
import { requireUser } from "@/lib/auth/session";
import { monthStart } from "@/lib/budget";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSettings, num } from "@/lib/settings";
import { byModel, dailySeries } from "@/lib/usage";

export const metadata = { title: "Panel de operaciones" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denegado?: string }> }) {
  const user = await requireUser();
  const { denegado } = await searchParams;
  const orgView = can(user.role, "usage.view_all");
  const settings = await getSettings();
  const from = monthStart();
  const scope = orgView ? {} : { userId: user.id };

  const last30 = new Date();
  last30.setDate(last30.getDate() - 29);
  last30.setHours(0, 0, 0, 0);

  const [mine, org, convCount, msgToday, activeUsers, series, models, recent, providers, enabledModels] = await Promise.all([
    db.usageRecord.aggregate({ where: { userId: user.id, createdAt: { gte: from } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    db.usageRecord.aggregate({ where: { createdAt: { gte: from } }, _sum: { costUsd: true }, _count: { _all: true } }),
    db.conversation.count({ where: { userId: user.id } }),
    db.message.count({ where: { role: "user", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, conversation: orgView ? {} : { userId: user.id } } }),
    db.usageRecord.groupBy({ by: ["userId"], where: { createdAt: { gte: from } } }),
    dailySeries(scope, last30, new Date()),
    byModel({ ...scope, createdAt: { gte: from } }),
    db.conversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 6, include: { _count: { select: { messages: true } } } }),
    Promise.resolve(providerStatus()),
    db.aiModel.findMany({ where: { enabled: true }, select: { provider: true } }),
  ]);

  const anyCost = series.some((d) => d.value > 0) || models.some((m) => m.cost > 0);
  const myBudget = user.monthlyBudgetUsd ?? num(settings.default_user_budget_usd);
  const mySpend = mine._sum.costUsd ?? 0;
  const pct = myBudget ? Math.min(100, (mySpend / myBudget) * 100) : null;
  const globalBudget = num(settings.global_monthly_budget_usd);
  const monthName = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <Page>
      <PageHeader
        title={`Hola, ${user.name.split(" ")[0]}`}
        subtitle={`Centro de operaciones · ${monthName}`}
        actions={
          <Link href="/chat" className="btn-primary">
            <IconChat /> Nueva conversación
          </Link>
        }
      />

      {denegado && (
        <p className="mb-6 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">No tienes permiso para acceder a esa sección.</p>
      )}

      {providers.every((p) => !p.configured) && (
        <div className="mb-6 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
          <p className="font-medium text-warn">Ningún proveedor de IA está conectado</p>
          <p className="mt-1 text-muted">
            Para empezar gratis añade al menos una de estas claves en las variables de entorno del servidor (en Vercel: Settings → Environment Variables) y vuelve a desplegar:{" "}
            <code>GEMINI_API_KEY</code>, <code>GROQ_API_KEY</code> u <code>OPENROUTER_API_KEY</code>. Instrucciones en Administración → Modelos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Mi gasto este mes"
          value={formatUsd(mySpend)}
          hint={myBudget ? `${pct!.toFixed(0)} % de ${formatUsd(myBudget)}` : "Sin límite asignado"}
          tone={pct !== null && pct >= 90 ? "bad" : pct !== null && pct >= 70 ? "warn" : undefined}
        />
        <Stat label="Mis peticiones" value={(mine._count._all ?? 0).toLocaleString("es-ES")} hint={`${formatTokens((mine._sum.inputTokens ?? 0) + (mine._sum.outputTokens ?? 0))} tokens`} />
        {orgView ? (
          <>
            <Stat
              label="Gasto de la organización"
              value={formatUsd(org._sum.costUsd ?? 0)}
              hint={globalBudget ? `Presupuesto: ${formatUsd(globalBudget)}` : `${org._count._all} peticiones`}
            />
            <Stat label="Usuarios activos" value={String(activeUsers.length)} hint={`${msgToday} mensajes hoy`} />
          </>
        ) : (
          <>
            <Stat label="Conversaciones" value={String(convCount)} />
            <Stat label="Mensajes hoy" value={String(msgToday)} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">{anyCost ? "Gasto diario" : "Peticiones diarias"} · últimos 30 días</h2>
            <Link href="/usage" className="text-xs text-accent hover:underline">Ver detalle</Link>
          </div>
          <DailyBars
            data={series}
            metric={anyCost ? "usd" : "calls"}
            label={`${orgView ? "Toda la organización" : "Tu consumo"} (${anyCost ? "USD" : "peticiones; todo gratuito"})`}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-medium">Estado de los proveedores</h2>
          <ul className="space-y-3">
            {providers.map((p) => {
              const n = enabledModels.filter((m) => m.provider === p.id).length;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{PROVIDER_LABELS[p.id as ProviderId].split(" · ")[0]}</span>
                  {p.configured ? (
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-ok">
                      <span className="size-2 rounded-full bg-ok" /> Conectado · {n}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-muted">
                      <span className="size-2 rounded-full border border-muted" /> Sin clave
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Accesos rápidos</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link href="/search" className="btn-ghost justify-start"><IconSearch width={16} /> Buscar</Link>
              <Link href="/files" className="btn-ghost justify-start"><IconFile width={16} /> Archivos</Link>
              <Link href="/usage" className="btn-ghost justify-start"><IconChat width={16} /> Consumo</Link>
              <Link href="/agents" className="btn-ghost justify-start"><IconBot width={16} /> Agentes</Link>
            </div>
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium">{anyCost ? "Gasto" : "Peticiones"} por modelo · este mes</h2>
          <ModelBars
            format={anyCost ? formatUsd : (v) => `${v} pet.`}
            rows={models.map((m) =>
              anyCost
                ? { label: m.label, provider: m.provider, value: m.cost, sub: `${m.calls} pet.` }
                : { label: m.label, provider: m.provider, value: m.calls, sub: "gratis" },
            )}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-medium">Conversaciones recientes</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Empieza tu primera conversación.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">{c._count.messages} msj.</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
