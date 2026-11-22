"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-medium">Cambiar contraseña</h2>
      <div><label className="label">Contraseña actual</label><input name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div><label className="label">Nueva contraseña</label><input name="next" type="password" autoComplete="new-password" required minLength={10} className="input" /></div>
      <div><label className="label">Repite la nueva contraseña</label><input name="confirm" type="password" autoComplete="new-password" required className="input" /></div>
      <p className="text-xs text-muted">Mínimo 10 caracteres, combinando letras y números.</p>
      <FormMessage state={state} />
      <button className="btn-primary" disabled={pending}>Actualizar</button>
    </form>
  );
}
