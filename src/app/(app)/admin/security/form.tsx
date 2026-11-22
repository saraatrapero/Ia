"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/actions/admin";
import { FormMessage } from "@/components/form-message";

export function SettingsForm({ fields }: { fields: { key: string; label: string; help: string; value: string }[] }) {
  const [state, action, pending] = useActionState(updateSettingsAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-medium">Políticas</h2>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="label" htmlFor={f.key}>{f.label}</label>
          {f.key === "cost_mode" ? (
            <select id={f.key} name={f.key} defaultValue={f.value} className="input">
              <option value="free_only">Solo gratuitos (coste 0)</option>
              <option value="economic">Económico: prioriza gratuitos y baratos</option>
              <option value="quality">Calidad: prioriza el mejor modelo</option>
            </select>
          ) : f.key === "system_prompt_extra" ? (
            <textarea id={f.key} name={f.key} defaultValue={f.value} rows={4} className="input" />
          ) : (
            <input id={f.key} name={f.key} defaultValue={f.value} className="input" />
          )}
          <p className="mt-1 text-xs text-muted">{f.help}</p>
        </div>
      ))}
      <FormMessage state={state} />
      <button className="btn-primary" disabled={pending}>Guardar políticas</button>
    </form>
  );
}
