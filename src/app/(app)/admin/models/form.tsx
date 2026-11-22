"use client";

import { useActionState, useState, useTransition } from "react";
import { checkProvidersAction, updateModelAction, type ProviderCheck } from "@/app/actions/admin";
import { FormMessage } from "@/components/form-message";
import { ProviderDot } from "@/components/provider-dot";

export function ModelForm({
  model,
  providerReady,
}: {
  model: {
    id: string; provider: string; label: string; apiModel: string; tier: string; description: string;
    inputPrice: number; outputPrice: number; minRole: string; enabled: boolean; free: boolean; contextWindow: number; strengths: string;
  };
  providerReady: boolean;
}) {
  const [state, action, pending] = useActionState(updateModelAction, undefined);
  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="id" value={model.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <ProviderDot provider={model.provider} /> {model.label}
            {model.free && <span className="badge border-ok/40 text-ok">gratis</span>}
            {!providerReady && <span className="badge">proveedor sin clave</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">{model.description}</p>
          <p className="mt-0.5 text-xs text-muted">Contexto: {(model.contextWindow / 1000).toLocaleString("es-ES")}k tokens · {model.strengths}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="free" defaultChecked={model.free} className="size-4" /> Gratuito</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={model.enabled} className="size-4" /> Activo</label>
        </div>
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
        <div className="col-span-2 flex items-end md:col-span-4"><FormMessage state={state} /></div>
        <div className="col-span-2 flex items-end justify-end md:col-span-1">
          <button className="btn-primary w-full" disabled={pending}>Guardar</button>
        </div>
      </div>
    </form>
  );
}

export function ProviderChecker() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; results?: ProviderCheck[] } | null>(null);
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Comprobar proveedores</p>
          <p className="text-sm text-muted">Conecta con cada proveedor configurado y verifica que los identificadores del catálogo existen hoy.</p>
        </div>
        <button className="btn-ghost" disabled={pending} onClick={() => start(async () => setRes(await checkProvidersAction()))}>
          {pending ? "Comprobando…" : "Comprobar ahora"}
        </button>
      </div>
      {res?.error && <p className="mt-3 text-sm text-bad">{res.error}</p>}
      {res?.results && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {res.results.map((r) => (
            <div key={r.provider} className="rounded-lg border border-line p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <ProviderDot provider={r.provider} /> {r.provider}
                <span className={`ml-auto text-xs ${!r.configured ? "text-muted" : r.ok ? "text-ok" : "text-bad"}`}>
                  {!r.configured ? "sin clave" : r.ok ? `conectado · ${r.total} modelos` : "error"}
                </span>
              </p>
              {r.error && <p className="mt-1 text-xs text-bad">{r.error}</p>}
              {r.configured && r.ok && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {r.models.map((m) => (
                    <li key={m.id} className={m.found ? "text-ok" : "text-warn"}>
                      {m.found ? "✓" : "✗"} {m.label} <code className="text-muted">{m.apiModel}</code>
                      {!m.found && " — no existe: cambia el ID en su ficha"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
