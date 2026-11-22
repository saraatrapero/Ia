import { Page, PageHeader } from "@/components/page-header";
import { AUDIT_LABELS } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PERMISSIONS, ROLE_LABELS, ROLES, hasRole } from "@/lib/permissions";
import { getSettings, SETTING_LABELS, type SettingKey } from "@/lib/settings";
import { SettingsForm } from "./form";

export const metadata = { title: "Seguridad y auditoría" };

const PERM_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  "chat.use": "Usar el chat",
  "files.upload": "Subir documentos",
  "usage.view_own": "Ver su consumo",
  "usage.view_all": "Ver consumo de la organización",
  "agents.view": "Ver agentes",
  "agents.manage": "Crear y programar agentes",
  "users.manage": "Gestionar usuarios",
  "models.manage": "Gestionar modelos",
  "security.manage": "Configurar seguridad",
  "audit.view": "Ver auditoría",
};

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ accion?: string }> }) {
  await requirePermission("security.manage");
  const { accion } = await searchParams;
  const [settings, logs, sessions, failures] = await Promise.all([
    getSettings(),
    db.auditLog.findMany({
      where: accion ? { action: accion } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
    db.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
  ]);

  return (
    <Page>
      <PageHeader title="Seguridad y auditoría" subtitle="Políticas de acceso, límites de uso, permisos y registro de actividad." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SettingsForm
            fields={(Object.keys(SETTING_LABELS) as SettingKey[]).map((k) => ({ key: k, ...SETTING_LABELS[k], value: settings[k] }))}
          />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-medium">Medidas activas</h2>
            <ul className="space-y-1.5 text-muted">
              <li>✓ Contraseñas cifradas con bcrypt (coste 12) y cambio obligatorio en el primer acceso</li>
              <li>✓ Sesiones firmadas, revocables y con caducidad; cookie HttpOnly, SameSite</li>
              <li>✓ Bloqueo temporal tras intentos fallidos ({failures} fallos en 24 h)</li>
              <li>✓ Claves de IA solo en el servidor; nunca llegan al navegador</li>
              <li>✓ Protección CSRF por origen y cabeceras de seguridad (HSTS, X-Frame-Options…)</li>
              <li>✓ Cada usuario solo accede a sus conversaciones y archivos</li>
              <li>✓ Límite de peticiones por minuto y presupuestos de gasto</li>
              <li>✓ Agentes sin capacidad de ejecución sobre sistemas reales</li>
            </ul>
          </div>
          <div className="card overflow-x-auto p-5">
            <h2 className="mb-3 font-medium">Matriz de permisos</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-medium">Permiso</th>{ROLES.map((r) => <th key={r} className="pb-2 font-medium">{ROLE_LABELS[r]}</th>)}</tr></thead>
              <tbody>
                {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).map((p) => (
                  <tr key={p} className="border-t border-line/60">
                    <td className="py-1.5">{PERM_LABELS[p]}</td>
                    {ROLES.map((r) => <td key={r} className="text-center">{hasRole(r, PERMISSIONS[p]) ? <span className="text-ok">✓</span> : <span className="text-muted">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-medium">Sesiones activas ({sessions.length})</h2>
        <table className="table mt-3">
          <thead><tr><th>Usuario</th><th>Inicio</th><th>Caduca</th><th>IP</th><th>Navegador</th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.user.name}<div className="text-xs text-muted">{s.user.email}</div></td>
                <td className="whitespace-nowrap">{s.createdAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="whitespace-nowrap">{s.expiresAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="font-mono text-xs">{s.ip ?? "—"}</td>
                <td className="max-w-xs truncate text-xs text-muted" title={s.userAgent ?? ""}>{s.userAgent ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="font-medium">Registro de auditoría</h2>
          <form className="flex gap-2">
            <select name="accion" defaultValue={accion ?? ""} className="input py-1.5 text-sm">
              <option value="">Todas las acciones</option>
              {Object.entries(AUDIT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn-ghost py-1.5">Filtrar</button>
          </form>
        </div>
        <table className="table mt-3">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>IP</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Sin registros.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{l.createdAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td>{l.user?.name ?? "—"}</td>
                <td className={l.action.includes("failed") || l.action.includes("blocked") ? "text-warn" : ""}>{AUDIT_LABELS[l.action] ?? l.action}</td>
                <td className="max-w-md truncate font-mono text-xs text-muted" title={l.details ?? ""}>{l.details ?? ""}</td>
                <td className="font-mono text-xs">{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}
