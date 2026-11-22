import { Page, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { PasswordForm } from "./form";

export const metadata = { title: "Mi cuenta" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ cambio?: string }> }) {
  const user = await requireUser();
  const { cambio } = await searchParams;
  return (
    <Page>
      <PageHeader title="Mi cuenta" />
      {(cambio || user.mustChangePassword) && (
        <p className="mb-6 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Por seguridad, debes establecer una contraseña personal antes de continuar.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-medium">Perfil</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Nombre</dt><dd>{user.name}</dd>
            <dt className="text-muted">Correo</dt><dd>{user.email}</dd>
            <dt className="text-muted">Rol</dt><dd>{ROLE_LABELS[user.role as Role] ?? user.role}</dd>
            <dt className="text-muted">Departamento</dt><dd>{user.department?.name ?? "—"}</dd>
            <dt className="text-muted">Presupuesto</dt><dd>{user.monthlyBudgetUsd !== null ? `${user.monthlyBudgetUsd} USD/mes` : "Por defecto de la organización"}</dd>
          </dl>
        </div>
        <PasswordForm />
      </div>
    </Page>
  );
}
