"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelOption, UiMessage } from "@/lib/chat-data";
import { IconCopy, IconDownload, IconFile, IconPaperclip, IconSend, IconSpark, IconStop, IconTrash } from "../icons";
import { ProviderDot } from "../provider-dot";
import { Markdown } from "./markdown";

type Pending = { localId: string; id?: string; filename: string; size: number; chars?: number; error?: string; uploading: boolean };
type Notice = { tone: "info" | "error"; text: string } | null;

const TIER: Record<string, string> = { fast: "Rápido", balanced: "Equilibrado", advanced: "Avanzado" };
const PROVIDER: Record<string, string> = { google: "Google", groq: "Groq", openrouter: "OpenRouter", anthropic: "Anthropic", openai: "OpenAI" };
const PROVIDER_ORDER = ["google", "groq", "openrouter", "anthropic", "openai"];
const EXPORTS = [
  { fmt: "docx", label: "Word" },
  { fmt: "xlsx", label: "Excel (tablas)" },
  { fmt: "md", label: "Markdown" },
  { fmt: "html", label: "HTML" },
  { fmt: "txt", label: "Texto" },
] as const;
const SUGGESTIONS = [
  "Resume este documento en 10 puntos clave y señala riesgos",
  "Redacta un correo profesional para proponer una reunión",
  "Crea una tabla comparativa de pros y contras de estas opciones",
  "Revisa este código y propón mejoras",
];

function usd(v?: number, free?: boolean) {
  if (free) return "gratis";
  if (!v) return "0 $";
  return v < 0.01 ? `${v.toFixed(4)} $` : `${v.toFixed(2)} $`;
}

/** Lee una respuesta NDJSON y entrega cada evento. */
async function readEvents(res: Response, onEvent: (ev: Record<string, unknown> & { type: string }) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
}

export function ChatView({
  models,
  mode,
  initial,
  userName,
  allowedExtensions,
}: {
  models: ModelOption[];
  mode: string;
  initial: { id: string | null; title: string; modelMode: string; messages: UiMessage[] };
  userName: string;
  allowedExtensions: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [messages, setMessages] = useState<UiMessage[]>(initial.messages);
  const [input, setInput] = useState("");
  const [modelMode, setModelMode] = useState(models.some((m) => m.id === initial.modelMode) ? initial.modelMode : "auto");
  const [comparing, setComparing] = useState(initial.modelMode === "compare");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const accept = allowedExtensions.split(",").map((e) => "." + e.trim()).join(",");

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const t = textRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 260) + "px";
  }, [input]);

  const patch = (id: string, fn: (m: UiMessage) => UiMessage) => setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  // ─── Documentos ──────────────────────────────────
  const upload = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      setPending((p) => [...p, { localId, filename: file.name, size: file.size, uploading: true }]);
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/attachments", { method: "POST", body: form });
        const data = await res.json();
        setPending((p) =>
          p.map((x) =>
            x.localId === localId
              ? res.ok
                ? { ...x, id: data.id, chars: data.charCount, uploading: false }
                : { ...x, error: data.error ?? "Error al subir", uploading: false }
              : x,
          ),
        );
      } catch {
        setPending((p) => p.map((x) => (x.localId === localId ? { ...x, error: "Error de red", uploading: false } : x)));
      }
    }
  }, []);

  // ─── Envío ───────────────────────────────────────
  async function post(url: string, body: unknown, ctrl: AbortController) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Error ${res.status}`);
    }
    return res;
  }

  function adoptConversation(id: string) {
    if (!conversationId) {
      setConversationId(id);
      window.history.replaceState(null, "", `/chat/${id}`);
      return true;
    }
    return false;
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    if (pending.some((p) => p.uploading)) {
      setNotice({ tone: "info", text: "Espera a que terminen de subirse los documentos." });
      return;
    }
    const ready = pending.filter((p) => p.id && !p.error);
    setNotice(null);
    setInput("");
    setPending([]);
    stickRef.current = true;

    const stamp = Date.now();
    const tempUser: UiMessage = {
      id: `tmp-u-${stamp}`,
      role: "user",
      kind: "answer",
      content: message,
      attachments: ready.map((p) => ({ id: p.id!, filename: p.filename })),
    };
    setMessages((m) => [...m, tempUser]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let isNew = false;
    const ids: string[] = []; // ids temporales de las respuestas en curso

    try {
      if (comparing) {
        const res = await post("/api/compare", { conversationId, message, modelIds: compareIds, attachmentIds: ready.map((p) => p.id) }, ctrl);
        await readEvents(res, (ev) => {
          if (ev.type === "meta") {
            isNew = adoptConversation(ev.conversationId as string) || isNew;
            const slots = ev.slots as { model: string; modelLabel: string; provider: string }[];
            const group = ev.userMessageId as string;
            patch(tempUser.id, (m) => ({ ...m, id: group }));
            const temps = slots.map((s, i): UiMessage => {
              const id = `tmp-c-${stamp}-${i}`;
              ids[i] = id;
              return { id, role: "assistant", kind: "compare", variantGroup: group, selected: false, content: "", status: "streaming", modelId: s.model, modelLabel: s.modelLabel, provider: s.provider };
            });
            setMessages((all) => [...all, ...temps]);
          } else if (ev.type === "delta") {
            patch(ids[ev.slot as number], (m) => ({ ...m, content: m.content + (ev.text as string) }));
          } else if (ev.type === "done") {
            const tmp = ids[ev.slot as number];
            patch(tmp, (m) => ({ ...m, id: ev.messageId as string, status: "ok", costUsd: ev.costUsd as number, free: ev.free as boolean, tokens: (ev.inputTokens as number) + (ev.outputTokens as number) }));
            ids[ev.slot as number] = ev.messageId as string;
          } else if (ev.type === "error") {
            patch(ids[ev.slot as number], (m) => ({ ...m, status: "error", content: m.content || `⚠ ${ev.message}` }));
          } else if (ev.type === "selected") {
            setMessages((all) => all.map((m) => (m.kind === "compare" && ids.includes(m.id) ? { ...m, selected: m.id === ev.messageId } : m)));
          }
        });
      } else {
        const tempId = `tmp-a-${stamp}`;
        ids[0] = tempId;
        setMessages((m) => [...m, { id: tempId, role: "assistant", kind: "answer", content: "", status: "streaming" }]);
        const res = await post("/api/chat", { conversationId, message, modelMode, attachmentIds: ready.map((p) => p.id) }, ctrl);
        await readEvents(res, (ev) => {
          if (ev.type === "meta") {
            isNew = adoptConversation(ev.conversationId as string) || isNew;
            patch(tempUser.id, (m) => ({ ...m, id: ev.userMessageId as string }));
            patch(ids[0], (m) => ({ ...m, modelId: ev.model as string, modelLabel: ev.modelLabel as string, provider: ev.provider as string, reason: ev.reason as string }));
          } else if (ev.type === "delta") {
            patch(ids[0], (m) => ({ ...m, content: m.content + (ev.text as string) }));
          } else if (ev.type === "failover") {
            setNotice({ tone: "info", text: `${ev.from} no respondió (${ev.reason}). Se ha pasado a ${ev.to}.` });
            patch(ids[0], (m) => ({ ...m, modelLabel: ev.to as string, provider: ev.provider as string }));
          } else if (ev.type === "done") {
            patch(ids[0], (m) => ({ ...m, id: ev.messageId as string, status: "ok", costUsd: ev.costUsd as number, free: ev.free as boolean, tokens: (ev.inputTokens as number) + (ev.outputTokens as number) }));
            ids[0] = ev.messageId as string;
            if (ev.title) setTitle(ev.title as string);
          } else if (ev.type === "error") {
            patch(ids[0], (m) => ({ ...m, status: "error" }));
            setNotice({ tone: "error", text: ev.message as string });
          }
        });
      }
    } catch (e) {
      const aborted = ctrl.signal.aborted;
      setMessages((all) => all.map((m) => (m.status === "streaming" ? { ...m, status: aborted ? "stopped" : "error" } : m)));
      if (!aborted) setNotice({ tone: "error", text: e instanceof Error ? e.message : "Error de conexión." });
    } finally {
      setMessages((all) => all.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" } : m)));
      setStreaming(false);
      abortRef.current = null;
      if (isNew) {
        setTitle(message.slice(0, 80));
        router.refresh();
      }
    }
  }

  async function secondOpinion(target: UiMessage) {
    if (streaming) return;
    setNotice(null);
    setStreaming(true);
    stickRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let id = `tmp-r-${Date.now()}`;
    // La revisión se coloca justo después del bloque de la respuesta revisada
    setMessages((all) => {
      const idx = all.findIndex((m) => m.id === target.id);
      let at = idx + 1;
      while (at < all.length && all[at].role === "assistant" && (all[at].variantGroup === target.variantGroup || all[at].kind === "review")) at++;
      const copy = [...all];
      copy.splice(at, 0, { id, role: "assistant", kind: "review", variantGroup: target.id, content: "", status: "streaming", selected: target.selected });
      return copy;
    });
    try {
      const res = await post("/api/second-opinion", { messageId: target.id }, ctrl);
      await readEvents(res, (ev) => {
        if (ev.type === "meta") patch(id, (m) => ({ ...m, modelLabel: ev.modelLabel as string, provider: ev.provider as string }));
        else if (ev.type === "delta") patch(id, (m) => ({ ...m, content: m.content + (ev.text as string) }));
        else if (ev.type === "done") {
          patch(id, (m) => ({ ...m, id: ev.messageId as string, status: "ok", costUsd: ev.costUsd as number, free: ev.free as boolean, tokens: (ev.inputTokens as number) + (ev.outputTokens as number) }));
          id = ev.messageId as string;
        } else if (ev.type === "error") {
          patch(id, (m) => ({ ...m, status: "error" }));
          setNotice({ tone: "error", text: ev.message as string });
        }
      });
    } catch (e) {
      patch(id, (m) => ({ ...m, status: ctrl.signal.aborted ? "stopped" : "error" }));
      if (!ctrl.signal.aborted) setNotice({ tone: "error", text: e instanceof Error ? e.message : "Error de conexión." });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function chooseVariant(m: UiMessage) {
    const res = await fetch(`/api/messages/${m.id}/select`, { method: "POST" });
    if (!res.ok) {
      setNotice({ tone: "error", text: (await res.json().catch(() => ({}))).error ?? "No se pudo elegir la respuesta." });
      return;
    }
    setMessages((all) => all.map((x) => (x.kind === "compare" && x.variantGroup === m.variantGroup ? { ...x, selected: x.id === m.id } : x)));
  }

  async function exportFile(body: Record<string, string>) {
    const res = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ tone: "error", text: data.error ?? "No se pudo generar el archivo." });
      return;
    }
    const a = document.createElement("a");
    a.href = data.url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function deleteConversation() {
    if (!conversationId || !confirm("¿Eliminar esta conversación y sus documentos? No se puede deshacer.")) return;
    await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    router.push("/chat");
    router.refresh();
  }

  const selected = models.find((m) => m.id === modelMode);

  // ─── Render de una respuesta ─────────────────────
  const renderAnswer = (m: UiMessage, compact = false) => {
    const done = m.status === "ok" && !m.id.startsWith("tmp");
    return (
      <div className="group min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {m.provider && <ProviderDot provider={m.provider} />}
          <span className="font-medium text-ink/90">
            {m.kind === "review" ? "Segunda opinión · " : ""}
            {m.modelLabel ?? "Seleccionando modelo…"}
          </span>
          {m.free && <span className="badge border-ok/40 text-ok">gratis</span>}
          {m.reason && !compact && m.kind === "answer" && <span className="hidden sm:inline">· {m.reason}</span>}
        </div>
        {m.content ? (
          <div className={m.status === "streaming" ? "cursor-blink" : ""}>
            <Markdown
              content={m.content}
              onDownloadCode={
                done
                  ? (code, filename) => {
                      const name = prompt("Nombre del archivo", filename);
                      if (name) exportFile({ messageId: m.id, code, filename: name });
                    }
                  : undefined
              }
            />
          </div>
        ) : m.status === "streaming" ? (
          <div className="flex gap-1 py-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        ) : null}
        {m.status === "stopped" && <p className="mt-2 text-xs text-warn">Respuesta detenida.</p>}
        {m.status === "error" && <p className="mt-2 text-xs text-bad">La respuesta no se completó.</p>}
        {done && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted transition sm:opacity-60 sm:group-hover:opacity-100">
            <button onClick={() => navigator.clipboard.writeText(m.content)} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-panel-2 hover:text-ink">
              <IconCopy width={13} height={13} /> Copiar
            </button>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-panel-2 hover:text-ink">
                <IconDownload width={13} height={13} /> Descargar
              </summary>
              <div className="absolute left-0 z-10 mt-1 w-44 rounded-lg border border-line-strong bg-panel p-1 shadow-xl">
                {EXPORTS.map((x) => (
                  <button
                    key={x.fmt}
                    onClick={(e) => {
                      (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
                      exportFile({ messageId: m.id, format: x.fmt });
                    }}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left text-ink hover:bg-panel-2"
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </details>
            {m.kind !== "review" && models.length > 1 && (
              <button
                onClick={() => secondOpinion(m)}
                disabled={streaming}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-panel-2 hover:text-ink disabled:opacity-50"
                title="Otro modelo revisa esta respuesta"
              >
                <IconSpark width={13} height={13} /> Segunda opinión
              </button>
            )}
            <span className="ml-1 tabular-nums">
              {m.tokens?.toLocaleString("es-ES")} tokens · {usd(m.costUsd, m.free)}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Agrupa las variantes de comparación consecutivas en un bloque
  const blocks: ({ type: "single"; m: UiMessage } | { type: "compare"; group: string; items: UiMessage[] })[] = [];
  for (const m of messages) {
    const last = blocks[blocks.length - 1];
    if (m.kind === "compare" && m.variantGroup) {
      if (last?.type === "compare" && last.group === m.variantGroup) last.items.push(m);
      else blocks.push({ type: "compare", group: m.variantGroup, items: [m] });
    } else blocks.push({ type: "single", m });
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-accent">
          Suelta los documentos para adjuntarlos
        </div>
      )}

      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-lg border border-line-strong p-0.5 text-[13px]" role="tablist" aria-label="Modo de respuesta">
            <button role="tab" aria-selected={!comparing} onClick={() => setComparing(false)} disabled={streaming} className={`rounded-md px-2.5 py-1 ${!comparing ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}>
              Una respuesta
            </button>
            <button
              role="tab"
              aria-selected={comparing}
              onClick={() => setComparing(true)}
              disabled={streaming || models.length < 2}
              title={models.length < 2 ? "Hacen falta al menos dos modelos disponibles" : "La misma pregunta a varios modelos a la vez"}
              className={`rounded-md px-2.5 py-1 disabled:opacity-40 ${comparing ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}
            >
              Comparar
            </button>
          </div>
          {!comparing && (
            <>
              <label className="sr-only" htmlFor="model">Modelo</label>
              <select id="model" value={modelMode} onChange={(e) => setModelMode(e.target.value)} disabled={streaming} className="input w-auto max-w-[200px] py-1.5 text-[13px]">
                <option value="auto">✦ Automático</option>
                {PROVIDER_ORDER.map((p) => {
                  const group = models.filter((m) => m.provider === p);
                  if (!group.length) return null;
                  return (
                    <optgroup key={p} label={PROVIDER[p]}>
                      {group.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} · {TIER[m.tier] ?? m.tier}{m.free ? " · gratis" : ""}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </>
          )}
          {conversationId && (
            <button onClick={deleteConversation} className="rounded-md p-2 text-muted hover:bg-panel-2 hover:text-bad" title="Eliminar conversación">
              <IconTrash width={16} height={16} />
            </button>
          )}
        </div>
        {comparing && (
          <div className="flex w-full flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-muted">Comparar:</span>
            {models.map((m) => {
              const on = compareIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  disabled={streaming || (!on && compareIds.length >= 3)}
                  onClick={() => setCompareIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                  className={`badge py-1 transition disabled:opacity-40 ${on ? "border-accent bg-accent/15 text-ink" : "hover:text-ink"}`}
                  aria-pressed={on}
                >
                  <ProviderDot provider={m.provider} /> {m.label}
                </button>
              );
            })}
            <span className="text-muted">{compareIds.length === 0 ? "· sin selección: elección automática de 3 proveedores distintos" : `· ${compareIds.length}/3`}</span>
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className={`mx-auto w-full px-4 py-6 sm:px-6 ${blocks.some((b) => b.type === "compare") || comparing ? "max-w-6xl" : "max-w-3xl"}`}>
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-3xl flex-col items-center pt-[8vh] text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white">
                <IconSpark />
              </div>
              <h2 className="mt-4 text-xl font-semibold">¿En qué trabajamos hoy, {userName}?</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                {models.length === 0
                  ? mode === "free_only"
                    ? "No hay modelos gratuitos disponibles todavía. El administrador debe añadir una clave de Gemini, Groq u OpenRouter."
                    : "No hay modelos disponibles todavía. El administrador debe conectar los proveedores."
                  : comparing
                    ? "Tu pregunta se enviará a varios modelos a la vez para comparar sus respuestas."
                    : modelMode === "auto"
                      ? `El selector automático elegirá el modelo más adecuado${mode === "free_only" ? " entre los gratuitos" : ""}.`
                      : `Usando ${selected?.label}: ${selected?.description}`}
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textRef.current?.focus();
                    }}
                    className="card px-3 py-2.5 text-left text-sm text-muted transition hover:border-line-strong hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {blocks.map((b) =>
              b.type === "compare" ? (
                <div key={b.group} className={`grid gap-3 ${b.items.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
                  {b.items.map((m) => (
                    <div key={m.id} className={`card min-w-0 p-4 ${m.selected ? "border-accent/60" : ""}`}>
                      {renderAnswer(m, true)}
                      {m.status === "ok" && !m.id.startsWith("tmp") && (
                        <div className="mt-3 border-t border-line pt-2 text-xs">
                          {m.selected ? (
                            <span className="text-accent">✓ Se usa para continuar la conversación</span>
                          ) : (
                            <button onClick={() => chooseVariant(m)} disabled={streaming} className="text-muted hover:text-ink disabled:opacity-50">
                              Continuar con esta respuesta
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : b.m.role === "user" ? (
                <div key={b.m.id} className="mx-auto flex max-w-3xl flex-col items-end gap-1.5">
                  {b.m.attachments && b.m.attachments.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {b.m.attachments.map((a) => (
                        <a key={a.id} href={`/api/files/${a.id}?tipo=subido`} className="badge hover:text-ink">
                          <IconFile width={12} height={12} /> {a.filename}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-panel-2 px-4 py-2.5 text-[15px]">{b.m.content}</div>
                </div>
              ) : (
                <div key={b.m.id} className={`mx-auto max-w-3xl ${b.m.kind === "review" ? "rounded-xl border border-accent-2/40 bg-accent-2/5 p-4" : ""}`}>
                  {renderAnswer(b.m)}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Compositor */}
      <div className="border-t border-line bg-bg/80 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          {notice && (
            <div className={`mb-2 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${notice.tone === "error" ? "border-bad/30 bg-bad/10 text-bad" : "border-accent/30 bg-accent/10 text-ink"}`}>
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} className="text-muted hover:text-ink" aria-label="Cerrar aviso">✕</button>
            </div>
          )}
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pending.map((p) => (
                <span key={p.localId} className={`badge py-1 ${p.error ? "border-bad/40 text-bad" : ""}`} title={p.error ?? (p.chars ? `${p.chars.toLocaleString("es-ES")} caracteres extraídos` : "")}>
                  <IconFile width={12} height={12} />
                  <span className="max-w-[180px] truncate">{p.filename}</span>
                  {p.uploading ? <span>· leyendo…</span> : p.error ? <span>· {p.error}</span> : <span>· listo</span>}
                  <button onClick={() => setPending((all) => all.filter((x) => x.localId !== p.localId))} className="ml-0.5 hover:text-ink" aria-label="Quitar">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-panel p-2 focus-within:border-accent">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-ink" title={`Adjuntar documentos (${allowedExtensions})`}>
              <IconPaperclip />
            </button>
            <textarea
              ref={textRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={comparing ? "Pregunta para comparar entre modelos…" : "Escribe tu mensaje… (Mayús+Intro para nueva línea)"}
              className="max-h-64 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted/70"
            />
            {streaming ? (
              <button onClick={() => abortRef.current?.abort()} className="btn-ghost size-10 p-0" title="Detener">
                <IconStop />
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim() || models.length === 0} className="btn-primary size-10 p-0" title="Enviar">
                <IconSend />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">Las respuestas de la IA pueden contener errores. Verifica la información importante.</p>
        </div>
      </div>
    </div>
  );
}
