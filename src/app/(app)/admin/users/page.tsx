import { Page, PageHeader } from "@/components/page-header";
import { formatUsd } from "@/lib/ai/pricing";
import { requirePermission } from "@/lib/auth/session";
import { monthStart } from "@/lib/budget";
import { db } from "@/lib/db";
import { getSetting, num } from "@/lib/settings";
import { CreateDepartmentForm, CreateUserForm, UserRow } from "./forms";

export const metadata = { title: "Usuarios y roles" };

export default async function UsersPage() {
  const me = await requirePermission("users.manage");
  const [users, departments, spend, defaultBudget] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { department: true, _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } } },
    }),
    db.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    db.usageRecord.groupBy({ by: ["userId"], where: { createdAt: { gte: monthStart() } }, _sum: { costUsd: true } }),
    getSetting("default_user_budget_usd"),
  ]);
  const spent = new Map(spend.map((s) => [s.userId, s._sum.costUsd ?? 0]));
  const deps = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <Page>
      <PageHeader title="Usuarios y roles" subtitle={`${users.filter((u) => u.active).length} usuarios activos · ${departments.length} departamentos`} />

      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Departamento</th><th>Presupuesto/mes (USD)</th><th>Gasto mes</th><th>Activo</th><th>Último acceso</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                isSelf={u.id === me.id}
                departments={deps}
                defaultBudget={num(defaultBudget)}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  departmentId: u.departmentId,
                  monthlyBudgetUsd: u.monthlyBudgetUsd,
                  active: u.active,
                  lastLogin: u.lastLoginAt ? u.lastLoginAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Nunca",
                  sessions: u._count.sessions,
                  spent: formatUsd(spent.get(u.id) ?? 0),
                  mustChange: u.mustChangePassword,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><CreateUserForm departments={deps} /></div>
        <div className="space-y-6">
          <CreateDepartmentForm />
          <div className="card p-5">
            <h2 className="mb-3 font-medium">Departamentos</h2>
            {departments.length === 0 && <p className="text-sm text-muted">Aún no hay departamentos.</p>}
            <ul className="space-y-1 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="flex justify-between"><span>{d.name}</span><span className="text-muted">{d._count.users} usuarios</span></li>
              ))}
            </ul>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="mb-2 font-medium">Roles</h2>
            <ul className="space-y-2 text-muted">
              <li><b className="text-ink">Miembro:</b> chat, documentos, archivos y su propio consumo.</li>
              <li><b className="text-ink">Responsable:</b> además, ve el consumo de toda la organización.</li>
              <li><b className="text-ink">Administrador:</b> gestiona usuarios, modelos, seguridad y agentes.</li>
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
}
