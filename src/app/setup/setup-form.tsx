"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions/setup";
import { FormMessage } from "@/components/form-message";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">Código de instalación</label>
        <input id="code" name="code" type="password" required className="input" autoComplete="off" />
        <p className="mt-1 text-xs text-muted">El valor de SETUP_CODE que pusiste en la configuración del servidor.</p>
      </div>
      <div><label className="label" htmlFor="name">Tu nombre</label><input id="name" name="name" required className="input" /></div>
      <div><label className="label" htmlFor="email">Correo</label><input id="email" name="email" type="email" required className="input" autoComplete="username" /></div>
      <div><label className="label" htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required minLength={10} className="input" autoComplete="new-password" /></div>
      <div><label className="label" htmlFor="confirm">Repite la contraseña</label><input id="confirm" name="confirm" type="password" required className="input" autoComplete="new-password" /></div>
      <p className="text-xs text-muted">Mínimo 10 caracteres, combinando letras y números.</p>
      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creando…" : "Crear administrador"}</button>
    </form>
  );
}
