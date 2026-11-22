import { Page, PageHeader } from "@/components/page-header";
import { ProviderDot } from "@/components/provider-dot";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/ai/catalog";
import { providerStatus } from "@/lib/ai/providers";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ModelForm } from "./form";

export const metadata = { title: "Modelos y proveedores" };

export default async function ModelsPage() {
  await requirePermission("models.manage");
  const models = await db.aiModel.findMany({ orderBy: { sortOrder: "asc" } });
  const status = providerStatus();
  const envName: Record<string, string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", google: "GEMINI_API_KEY" };

  return (
    <Page>
      <PageHeader title="Modelos y proveedores" subtitle="Activa modelos, ajusta precios e identificadores y decide quién puede usarlos." />

      <div className="mb-8 grid gap-3 md:grid-cols-3">
        {status.map((s) => (
          <div key={s.id} className="card p-4">
            <p className="flex items-center gap-2 font-medium"><ProviderDot provider={s.id} />{PROVIDER_LABELS[s.id as ProviderId]}</p>
            <p className={`mt-2 text-sm ${s.configured ? "text-ok" : "text-muted"}`}>
              {s.configured ? "Clave configurada" : <>Falta <code className="text-xs">{envName[s.id]}</code> en el servidor</>}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {models.map((m) => (
          <ModelForm
            key={m.id}
            model={{
              id: m.id, provider: m.provider, label: m.label, apiModel: m.apiModel, tier: m.tier, description: m.description,
              inputPrice: m.inputPrice, outputPrice: m.outputPrice, minRole: m.minRole, enabled: m.enabled,
              contextWindow: m.contextWindow, strengths: m.strengths,
            }}
            providerReady={status.find((s) => s.id === m.provider)?.configured ?? false}
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line p-4 text-sm text-muted">
        <p className="font-medium text-ink">Cómo funciona el selector automático</p>
        <p className="mt-1">
          Elige entre los modelos activos según la petición: programación → Claude equilibrado; análisis complejo → modelo avanzado
          (preferencia Claude); redacción → GPT; documentos muy largos o datos → Gemini; consultas breves → el modelo rápido más barato.
          Si un proveedor falla antes de empezar a responder, cambia automáticamente a otro. El motivo de cada elección se muestra en el chat.
          Los precios de OpenAI y Google son orientativos: verifícalos en la web de cada proveedor.
        </p>
      </div>
    </Page>
  );
}
