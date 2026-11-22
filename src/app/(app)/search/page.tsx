import Link from "next/link";
import { Page, PageHeader, Stat } from "@/components/page-header";
import { ProviderDot } from "@/components/provider-dot";
import { formatUsd } from "@/lib/ai/pricing";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Búsqueda y análisis" };

function snippet(text: string, q: string, radius = 110) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return { before: text.slice(0, radius * 2), match: "", after: "" };
  const start = Math.max(0, i - radius);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, i),
    match: text.slice(i, i + q.length),
    after: text.slice(i + q.length, i + q.length + radius) + (i + q.length + radius < text.length ? "…" : ""),
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; en?: string; desde?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const scope = sp.en ?? "todo";
  const since = sp.desde ? new Date(sp.desde) : undefined;
  const dateFilter = since && !isNaN(since.getTime()) ? { gte: since } : undefined;

  const [messages, docs, titles] = q
    ? await Promise.all([
        scope === "documentos"
          ? []
          : db.message.findMany({
              where: { content: { contains: q }, conversation: { userId: user.id }, createdAt: dateFilter },
              include: { conversation: { select: { id: true, title: true } } },
              orderBy: { createdAt: "desc" },
              take: 60,
            }),
        scope === "conversaciones"
          ? []
          : db.attachment.findMany({
              where: { userId: user.id, createdAt: dateFilter, OR: [{ filename: { contains: q } }, { extractedText: { contains: q } }] },
              select: { id: true, filename: true, extractedText: true, conversationId: true, createdAt: true, charCount: true },
              orderBy: { createdAt: "desc" },
              take: 30,
            }),
        scope === "documentos"
          ? []
          : db.conversation.findMany({
              where: { userId: user.id, title: { contains: q }, createdAt: dateFilter },
              orderBy: { updatedAt: "desc" },
              take: 20,
            }),
      ])
    : [[], [], []];

  // Análisis de los resultados
  const byModel = new Map<string, number>();
  for (const m of messages) if (m.role === "assistant" && m.modelId) byModel.set(m.modelId, (byModel.get(m.modelId) ?? 0) + 1);
  const convIds = new Set(messages.map((m) => m.conversationId));
  const cost = messages.reduce((s, m) => s + m.costUsd, 0);
  const labels = new Map((await db.aiModel.findMany({ select: { id: true, label: true, provider: true } })).map((m) => [m.id, m]));

  return (
    <Page>
      <PageHeader title="Búsqueda y análisis" subtitle="Encuentra cualquier conversación, respuesta o documento que hayas trabajado." />

      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_180px_170px_auto]">
        <input name="q" defaultValue={q} placeholder="Buscar en conversaciones y documentos…" className="input" autoFocus />
        <select name="en" defaultValue={scope} className="input">
          <option value="todo">Todo</option>
          <option value="conversaciones">Solo conversaciones</option>
          <option value="documentos">Solo documentos</option>
        </select>
        <input type="date" name="desde" defaultValue={sp.desde} className="input" aria-label="Desde" />
        <button className="btn-primary">Buscar</button>
      </form>

      {!q ? (
        <p className="py-16 text-center text-sm text-muted">Escribe un término para empezar. La búsqueda solo incluye tu propio contenido.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Mensajes encontrados" value={String(messages.length)} />
            <Stat label="Conversaciones" value={String(new Set([...convIds, ...titles.map((t) => t.id)]).size)} />
            <Stat label="Documentos" value={String(docs.length)} />
            <Stat label="Coste de esas respuestas" value={formatUsd(cost)} />
          </div>

          {byModel.size > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {[...byModel.entries()].map(([id, n]) => (
                <span key={id} className="badge py-1">
                  <ProviderDot provider={labels.get(id)?.provider ?? ""} /> {labels.get(id)?.label ?? id}: {n} respuestas
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="space-y-3 lg:col-span-2">
              <h2 className="text-sm font-medium text-muted">Mensajes</h2>
              {titles.map((c) => (
                <Link key={c.id} href={`/chat/${c.id}`} className="card block p-4 hover:border-line-strong">
                  <p className="text-xs text-muted">Título de conversación</p>
                  <p className="mt-1 font-medium">{c.title}</p>
                </Link>
              ))}
              {messages.length === 0 && titles.length === 0 && <p className="text-sm text-muted">Sin coincidencias.</p>}
              {messages.map((m) => {
                const s = snippet(m.content, q);
                return (
                  <Link key={m.id} href={`/chat/${m.conversation.id}`} className="card block p-4 hover:border-line-strong">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="truncate">{m.conversation.title}</span>
                      <span className="shrink-0">
                        {m.role === "user" ? "Tú" : labels.get(m.modelId ?? "")?.label ?? "Asistente"} ·{" "}
                        {m.createdAt.toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink/90">
                      {s.before}
                      <mark className="rounded bg-accent/30 px-0.5 text-ink">{s.match}</mark>
                      {s.after}
                    </p>
                  </Link>
                );
              })}
            </section>
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">Documentos</h2>
              {docs.length === 0 && <p className="text-sm text-muted">Sin coincidencias.</p>}
              {docs.map((d) => {
                const s = snippet(d.extractedText, q, 70);
                return (
                  <div key={d.id} className="card p-4">
                    <a href={`/api/files/${d.id}?tipo=subido`} className="font-medium hover:text-accent">{d.filename}</a>
                    <p className="mt-0.5 text-xs text-muted">{d.createdAt.toLocaleDateString("es-ES")} · {d.charCount.toLocaleString("es-ES")} caracteres</p>
                    {s.match && (
                      <p className="mt-2 text-sm text-ink/80">
                        {s.before}
                        <mark className="rounded bg-accent/30 px-0.5 text-ink">{s.match}</mark>
                        {s.after}
                      </p>
                    )}
                    {d.conversationId && (
                      <Link href={`/chat/${d.conversationId}`} className="mt-2 inline-block text-xs text-accent hover:underline">Abrir conversación</Link>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
