import { IconLock } from "@/components/icons";
import { Page, PageHeader } from "@/components/page-header";
import { AGENT_EXECUTION_ENABLED, AGENT_TOOLS, PERMISSION_LEVELS, type PermissionLevel } from "@/lib/agents/registry";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AgentForms } from "./forms";

export const metadata = { title: "Agentes y programación" };

export default async function AgentsPage() {
  const user = await requirePermission("agents.view");
  const manage = can(user.role, "agents.manage");
  const [agents, models] = await Promise.all([
    db.agent.findMany({ orderBy: { createdAt: "desc" }, include: { schedules: true, createdBy: { select: { name: true } }, _count: { select: { runs: true } } } }),
    db.aiModel.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true } }),
  ]);
  const modelLabel = new Map(models.map((m) => [m.id, m.label]));
  const toolLabel = new Map(AGENT_TOOLS.map((t) => [t.id, t.label]));

  return (
    <Page>
      <PageHeader title="Agentes y programación" subtitle="Estructura preparada para automatizar tareas con IA de forma controlada." />

      {!AGENT_EXECUTION_ENABLED && (
        <div className="mb-6 flex gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
          <IconLock className="mt-0.5 shrink-0 text-warn" />
          <div>
            <p className="font-medium text-warn">Ejecución de agentes desactivada (fase 1)</p>
            <p className="mt-1 text-muted">
              Se pueden definir agentes, sus permisos y sus programaciones, pero ninguno se ejecuta todavía. No hay agentes con permisos
              ilimitados sobre sistemas reales: el nivel «Ejecución» y las herramientas externas que actúan en tu nombre están bloqueados hasta
              completar la revisión de seguridad.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-3 md:grid-cols-3">
        {(Object.entries(PERMISSION_LEVELS) as [PermissionLevel, (typeof PERMISSION_LEVELS)[PermissionLevel]][]).map(([k, v]) => (
          <div key={k} className={`card p-4 ${v.available ? "" : "opacity-60"}`}>
            <p className="flex items-center gap-2 font-medium">
              {!v.available && <IconLock width={15} />} {v.label}
            </p>
            <p className="mt-1 text-sm text-muted">{v.description}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted">Agentes definidos ({agents.length})</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="mt-0.5 text-sm text-muted">{a.description}</p>
              </div>
              <span className="badge shrink-0">{a.enabled && AGENT_EXECUTION_ENABLED ? "Activo" : "Inactivo"}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Modelo</dt><dd>{modelLabel.get(a.modelId) ?? a.modelId}</dd>
              <dt className="text-muted">Permiso</dt><dd>{PERMISSION_LEVELS[a.permissionLevel as PermissionLevel]?.label ?? a.permissionLevel}</dd>
              <dt className="text-muted">Herramientas</dt>
              <dd>{a.tools ? a.tools.split(",").map((t) => toolLabel.get(t) ?? t).join(", ") : "Ninguna"}</dd>
              <dt className="text-muted">Creado por</dt><dd>{a.createdBy.name}</dd>
            </dl>
            {a.schedules.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Programaciones</p>
                <ul className="space-y-1 text-sm">
                  {a.schedules.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span>{s.name}</span>
                      <code className="text-xs text-muted">{s.cron}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {manage && (
        <AgentForms
          models={models}
          agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          tools={AGENT_TOOLS.map((t) => ({ ...t, blocked: !PERMISSION_LEVELS[t.requires].available }))}
        />
      )}
    </Page>
  );
}
