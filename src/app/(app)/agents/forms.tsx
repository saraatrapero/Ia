"use client";

import { useActionState } from "react";
import { createAgentAction, createScheduleAction } from "@/app/actions/agents";
import { FormMessage } from "@/components/form-message";

export function AgentForms({
  models,
  agents,
  tools,
}: {
  models: { id: string; label: string }[];
  agents: { id: string; name: string }[];
  tools: { id: string; label: string; description: string; blocked: boolean }[];
}) {
  const [aState, aAction, aPending] = useActionState(createAgentAction, undefined);
  const [sState, sAction, sPending] = useActionState(createScheduleAction, undefined);
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <form action={aAction} className="card space-y-4 p-5">
        <h2 className="font-medium">Nuevo agente</h2>
        <div><label className="label">Nombre</label><input name="name" required className="input" /></div>
        <div><label className="label">Descripción</label><input name="description" className="input" /></div>
        <div><label className="label">Instrucciones</label><textarea name="systemPrompt" required rows={4} className="input" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Modelo</label>
            <select name="modelId" className="input">{models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </div>
          <div>
            <label className="label">Permiso</label>
            <select name="permissionLevel" className="input">
              <option value="read">Solo lectura</option>
              <option value="draft">Borrador con aprobación</option>
              <option value="execute" disabled>Ejecución (bloqueado)</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">Herramientas</legend>
          <div className="space-y-1.5">
            {tools.map((t) => (
              <label key={t.id} className={`flex items-start gap-2 text-sm ${t.blocked ? "opacity-50" : ""}`}>
                <input type="checkbox" name="tools" value={t.id} disabled={t.blocked} className="mt-1" />
                <span>{t.label}{t.blocked && " (bloqueada)"}<span className="block text-xs text-muted">{t.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormMessage state={aState} />
        <button className="btn-primary" disabled={aPending}>Crear agente</button>
      </form>

      <form action={sAction} className="card space-y-4 self-start p-5">
        <h2 className="font-medium">Nueva programación</h2>
        <div>
          <label className="label">Agente</label>
          <select name="agentId" className="input">{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
        <div><label className="label">Nombre</label><input name="name" required className="input" placeholder="Informe semanal" /></div>
        <div>
          <label className="label">Cuándo (cron)</label>
          <input name="cron" required className="input font-mono" placeholder="0 8 * * 1-5" />
          <p className="mt-1 text-xs text-muted">Minuto hora día mes día-semana. «0 8 * * 1-5» = laborables a las 8:00.</p>
        </div>
        <div><label className="label">Instrucción</label><textarea name="prompt" required rows={3} className="input" /></div>
        <FormMessage state={sState} />
        <button className="btn-primary" disabled={sPending || agents.length === 0}>Guardar programación</button>
      </form>
    </div>
  );
}
