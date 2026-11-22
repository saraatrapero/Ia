"use client";

import { useActionState } from "react";
import { createDepartmentAction, createUserAction, resetPasswordAction, revokeSessionsAction, updateUserAction } from "@/app/actions/admin";
import { FormMessage } from "@/components/form-message";

type Dep = { id: string; name: string };

const ROLE_OPTIONS = [
  ["MEMBER", "Miembro"],
  ["MANAGER", "Responsable"],
  ["ADMIN", "Administrador"],
] as const;

export function UserRow({
  user,
  departments,
  isSelf,
  defaultBudget,
}: {
  user: {
    id: string; name: string; email: string; role: string; departmentId: string | null; monthlyBudgetUsd: number | null;
    active: boolean; lastLogin: string; sessions: number; spent: string; mustChange: boolean;
  };
  departments: Dep[];
  isSelf: boolean;
  defaultBudget: number | null;
}) {
  const [state, action, pending] = useActionState(updateUserAction, undefined);
  const [rState, rAction, rPending] = useActionState(resetPasswordAction, undefined);
  const formId = `u-${user.id}`;
  return (
    <>
      <tr className={user.active ? "" : "opacity-60"}>
        <td>
          <form id={formId} action={action}><input type="hidden" name="id" value={user.id} /></form>
          <p className="font-medium">{user.name}{isSelf && <span className="ml-1 text-xs text-muted">(tú)</span>}</p>
          <p className="text-xs text-muted">{user.email}</p>
          {user.mustChange && <p className="text-xs text-warn">Pendiente de cambiar contraseña</p>}
        </td>
        <td>
          <select form={formId} name="role" defaultValue={user.role} className="input py-1.5">
            {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </td>
        <td>
          <select form={formId} name="departmentId" defaultValue={user.departmentId ?? ""} className="input py-1.5">
            <option value="">—</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </td>
        <td>
          <input
            form={formId}
            name="monthlyBudgetUsd"
            defaultValue={user.monthlyBudgetUsd ?? ""}
            placeholder={defaultBudget !== null ? `Por defecto (${defaultBudget})` : "Sin límite"}
            className="input w-36 py-1.5"
            inputMode="decimal"
          />
        </td>
        <td className="tabular-nums">{user.spent}</td>
        <td><input form={formId} type="checkbox" name="active" defaultChecked={user.active} className="size-4" /></td>
        <td className="whitespace-nowrap text-xs text-muted">{user.lastLogin}<br />{user.sessions} sesiones activas</td>
        <td className="whitespace-nowrap text-right">
          <button form={formId} className="btn-primary px-2.5 py-1 text-xs" disabled={pending}>Guardar</button>
          <details className="relative ml-1 inline-block text-left">
            <summary className="btn-ghost cursor-pointer list-none px-2 py-1 text-xs">···</summary>
            <div className="absolute right-0 z-10 mt-1 w-52 space-y-1 rounded-lg border border-line-strong bg-panel p-1.5 shadow-xl">
              <form action={rAction}>
                <input type="hidden" name="id" value={user.id} />
                <button className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-2" disabled={rPending}>Restablecer contraseña</button>
              </form>
              {!isSelf && (
                <form action={revokeSessionsAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <button className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-panel-2">Cerrar todas sus sesiones</button>
                </form>
              )}
            </div>
          </details>
        </td>
      </tr>
      {(state || rState) && (
        <tr><td colSpan={8} className="border-b-0 pt-0"><FormMessage state={rState ?? state} /></td></tr>
      )}
    </>
  );
}

export function CreateUserForm({ departments }: { departments: Dep[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-medium">Añadir usuario</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Nombre</label><input name="name" required className="input" /></div>
        <div><label className="label">Correo</label><input name="email" type="email" required className="input" /></div>
        <div>
          <label className="label">Rol</label>
          <select name="role" defaultValue="MEMBER" className="input">{ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div>
          <label className="label">Departamento</label>
          <select name="departmentId" className="input"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </div>
        <div><label className="label">Presupuesto mensual (USD)</label><input name="monthlyBudgetUsd" placeholder="Vacío = por defecto" className="input" inputMode="decimal" /></div>
        <div><label className="label">Contraseña inicial</label><input name="password" type="text" placeholder="Vacío = generar una segura" className="input" autoComplete="off" /></div>
      </div>
      <FormMessage state={state} />
      <button className="btn-primary" disabled={pending}>Crear usuario</button>
    </form>
  );
}

export function CreateDepartmentForm() {
  const [state, action, pending] = useActionState(createDepartmentAction, undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-medium">Nuevo departamento</h2>
      <input name="name" required className="input" placeholder="Ej.: Operaciones" />
      <FormMessage state={state} />
      <button className="btn-ghost" disabled={pending}>Crear</button>
    </form>
  );
}
