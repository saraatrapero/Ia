import { Page, PageHeader } from "@/components/page-header";
import { ProviderDot } from "@/components/provider-dot";
import { ensureCatalog } from "@/lib/ai/ensure-catalog";
import { PROVIDER_ENV, PROVIDER_LABELS, PROVIDER_SIGNUP, type ProviderId } from "@/lib/ai/catalog";
import { costMode } from "@/lib/ai/models";
import { providerStatus } from "@/lib/ai/providers";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ModelForm, ProviderChecker } from "./form";

export const metadata = { title: "Modelos y proveedores" };

const MODE_LABEL: Record<string, string> = {
  free_only: "Solo gratuitos (coste 0)",
  economic: "Económico",
  quality: "Calidad",
};

export default async function ModelsPage() {
  await requirePermission("models.manage");
  await ensureCatalog();
  const [models, mode] = await Promise.all([db.aiModel.findMany({ orderBy: { sortOrder: "asc" } }), costMode()]);
  const status = providerStatus();

  return (
    <Page>
      <PageHeader
        title="Modelos y proveedores"
        subtitle={`Modo de coste actual: ${MODE_LABEL[mode]} (se cambia en Seguridad y auditoría).`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {status.map((s) => {
          const signup = PROVIDER_SIGNUP[s.id as ProviderId];
          return (
            <div key={s.id} className="card p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><ProviderDot provider={s.id} />{PROVIDER_LABELS[s.id as ProviderId]}</p>
              <p className="mt-1 text-xs text-muted">{signup.free ? "Tiene plan gratuito" : "De pago por uso"}</p>
              <p className={`mt-2 text-sm ${s.configured ? "text-ok" : "text-muted"}`}>
                {s.configured ? "Clave configurada" : <>Falta <code className="text-xs">{PROVIDER_ENV[s.id as ProviderId]}</code></>}
              </p>
              {!s.configured && (
                <a href={signup.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-accent hover:underline">Obtener clave ↗</a>
              )}
            </div>
          );
        })}
      </div>

      <ProviderChecker />

      <div className="mt-6 space-y-3">
        {models.map((m) => (
          <ModelForm
            key={m.id}
            model={{
              id: m.id, provider: m.provider, label: m.label, apiModel: m.apiModel, tier: m.tier, description: m.description,
              inputPrice: m.inputPrice, outputPrice: m.outputPrice, minRole: m.minRole, enabled: m.enabled, free: m.free,
              contextWindow: m.contextWindow, strengths: m.strengths,
            }}
            providerReady={status.find((s) => s.id === m.provider)?.configured ?? false}
          />
        ))}
      </div>

      <div className="mt-6 space-y-3 rounded-xl border border-line p-4 text-sm text-muted">
        <p className="font-medium text-ink">Cómo elige el selector automático</p>
        <p>
          Clasifica la petición (programación, análisis complejo, redacción, datos y documentos, documentación muy extensa, consulta breve o
          general), descarta los modelos cuyo contexto no admite el tamaño de la conversación y puntúa el resto por capacidades, categoría,
          proveedor preferente y coste. En modo «Solo gratuitos» únicamente usa los modelos marcados como gratuitos. Si un proveedor falla antes
          de empezar a responder, pasa automáticamente a otro. El motivo de cada elección se muestra en el chat.
        </p>
        <p className="font-medium text-warn">Privacidad en los planes gratuitos</p>
        <p>
          En el nivel gratuito de Gemini, Google puede usar las peticiones para mejorar sus productos, y algunos modelos «:free» de OpenRouter
          registran las peticiones. No envíes datos personales sensibles ni confidenciales a modelos gratuitos. Los planes de pago de OpenAI,
          Anthropic y Google no usan los datos para entrenar.
        </p>
      </div>
    </Page>
  );
}
