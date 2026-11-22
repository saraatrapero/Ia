"use client";

import { useActionState } from "react";
import { updateModelAction } from "@/app/actions/admin";
import { FormMessage } from "@/components/form-message";
import { ProviderDot } from "@/components/provider-dot";

export function ModelForm({
  model,
  providerReady,
}: {
  model: {
    id: string; provider: string; label: string; apiModel: string; tier: string; description: string;
    inputPrice: number; outputPrice: number; minRole: string; enabled: boolean; contextWindow: number; strengths: string;
  };
  providerReady: boolean;
}) {
  const [state, action, pending] = useActionState(updateModelAction, undefined);
  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="id" value={model.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <ProviderDot provider={model.provider} /> {model.label}
            {!providerReady && <span className="badge">proveedor sin clave</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">{model.description}</p>
          <p className="mt-0.5 text-xs text-muted">Contexto: {(model.contextWindow / 1000).toLocaleString("es-ES")}k tokens · {model.strengths}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={model.enabled} className="size-4" /> Activo
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="col-span-2 md:col-span-1"><label className="label">Nombre</label><input name="label" defaultValue={model.label} className="input py-1.5" /></div>
        <div className="col-span-2"><label className="label">ID en la API</label><input name="apiModel" defaultValue={model.apiModel} className="input py-1.5 font-mono text-xs" /></div>
        <div>
          <label className="label">Categoría</label>
          <select name="tier" defaultValue={model.tier} className="input py-1.5">
            <option value="fast">Rápido</option><option value="balanced">Equilibrado</option><option value="advanced">Avanzado</option>
          </select>
        </div>
        <div><label className="label">$ / M entrada</label><input name="inputPrice" defaultValue={model.inputPrice} inputMode="decimal" className="input py-1.5" /></div>
        <div><label className="label">$ / M salida</label><input name="outputPrice" defaultValue={model.outputPrice} inputMode="decimal" className="input py-1.5" /></div>
        <div>
          <label className="label">Rol mínimo</label>
          <select name="minRole" defaultValue={model.minRole} className="input py-1.5">
            <option value="MEMBER">Miembro</option><option value="MANAGER">Responsable</option><option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end md:col-span-5">
          <FormMessage state={state} />
        </div>
        <div className="flex items-end justify-end">
          <button className="btn-primary w-full" disabled={pending}>Guardar</button>
        </div>
      </div>
    </form>
  );
}
