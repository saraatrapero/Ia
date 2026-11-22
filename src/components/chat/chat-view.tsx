"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelOption, UiMessage } from "@/lib/chat-data";
import { IconCopy, IconDownload, IconFile, IconPaperclip, IconSend, IconSpark, IconStop, IconTrash } from "../icons";
import { ProviderDot } from "../provider-dot";
import { Markdown } from "./markdown";

type Pending = { localId: string; id?: string; filename: string; size: number; chars?: number; error?: string; uploading: boolean };

const TIER: Record<string, string> = { fast: "Rápido", balanced: "Equilibrado", advanced: "Avanzado" };
const PROVIDER: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic", google: "Google" };
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

function usd(v?: number) {
  if (!v) return "0 $";
  return v < 0.01 ? `${v.toFixed(4)} $` : `${v.toFixed(2)} $`;
}

export function ChatView({
  models,
  initial,
  userName,
  allowedExtensions,
}: {
  models: ModelOption[];
  initial: { id: string | null; title: string; modelMode: string; messages: UiMessage[] };
  userName: string;
  allowedExtensions: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [messages, setMessages] = useState<UiMessage[]>(initial.messages);
  const [input, setInput] = useState("");
  const [modelMode, setModelMode] = useState(
    initial.modelMode === "auto" || models.some((m) => m.id === initial.modelMode) ? initial.modelMode : "auto",
  );
  const [pending, setPending] = useState<Pending[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
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

    const tempUser: UiMessage = {
      id: "tmp-u-" + Date.now(),
      role: "user",
      content: message,
      attachments: ready.map((p) => ({ id: p.id!, filename: p.filename })),
    };
    const tempAsst: UiMessage = { id: "tmp-a-" + Date.now(), role: "assistant", content: "", status: "streaming" };
    setMessages((m) => [...m, tempUser, tempAsst]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patchLast = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((all) => {
        const copy = [...all];
        const idx = copy.findLastIndex((x) => x.role === "assistant");
        if (idx >= 0) copy[idx] = fn(copy[idx]);
        return copy;
      });

    let newConversation = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message, modelMode, attachmentIds: ready.map((p) => p.id) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "meta") {
            if (!conversationId) {
              newConversation = true;
              setConversationId(ev.conversationId);
              window.history.replaceState(null, "", `/chat/${ev.conversationId}`);
            }
            setMessages((all) => all.map((m) => (m.id === tempUser.id ? { ...m, id: ev.userMessageId } : m)));
            patchLast((m) => ({ ...m, modelLabel: ev.modelLabel, provider: ev.provider, reason: ev.reason }));
          } else if (ev.type === "delta") {
            patchLast((m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "failover") {
            setNotice({ tone: "info", text: `${ev.from} no respondió (${ev.reason}). Se ha pasado a ${ev.to}.` });
            patchLast((m) => ({ ...m, modelLabel: ev.to }));
          } else if (ev.type === "done") {
            patchLast((m) => ({ ...m, id: ev.messageId, status: "ok", costUsd: ev.costUsd, tokens: ev.inputTokens + ev.outputTokens }));
            if (ev.title) setTitle(ev.title);
          } else if (ev.type === "error") {
            patchLast((m) => ({ ...m, status: "error" }));
            setNotice({ tone: "error", text: ev.message });
          }
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        patchLast((m) => ({ ...m, status: "stopped" }));
      } else {
        patchLast((m) => ({ ...m, status: "error" }));
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Error de conexión." });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (newConversation) router.refresh();
    }
  }

  // ─── Exportar ────────────────────────────────────
  async function exportFile(body: Record<string, string>) {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ tone: "error", text: data.error ?? "No se pudo generar el archivo." });
      return;
    }
    window.location.href = data.url;
  }

  async function deleteConversation() {
    if (!conversationId || !confirm("¿Eliminar esta conversación y sus documentos? No se puede deshacer.")) return;
    await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    router.push("/chat");
    router.refresh();
  }

  const selected = models.find((m) => m.id === modelMode);

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
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-6">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="model">Modelo</label>
          <select
            id="model"
            value={modelMode}
            onChange={(e) => setModelMode(e.target.value)}
            disabled={streaming}
            className="input w-auto max-w-[220px] py-1.5 text-[13px]"
          >
            <option value="auto">✦ Automático (recomendado)</option>
            {(["anthropic", "openai", "google"] as const).map((p) => {
              const group = models.filter((m) => m.provider === p);
              if (!group.length) return null;
              return (
                <optgroup key={p} label={PROVIDER[p]}>
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {TIER[m.tier] ?? m.tier}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {conversationId && (
            <button onClick={deleteConversation} className="rounded-md p-2 text-muted hover:bg-panel-2 hover:text-bad" title="Eliminar conversación">
              <IconTrash width={16} height={16} />
            </button>
          )}
        </div>
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
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-[8vh] text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white">
                <IconSpark />
              </div>
              <h2 className="mt-4 text-xl font-semibold">¿En qué trabajamos hoy, {userName}?</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                {models.length === 0
                  ? "No hay modelos disponibles todavía. El administrador debe conectar los proveedores."
                  : modelMode === "auto"
                    ? "El selector automático elegirá entre GPT, Claude y Gemini según tu petición."
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
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end gap-1.5">
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {m.attachments.map((a) => (
                        <a key={a.id} href={`/api/files/${a.id}?tipo=subido`} className="badge hover:text-ink">
                          <IconFile width={12} height={12} /> {a.filename}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-panel-2 px-4 py-2.5 text-[15px]">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="group">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {m.provider && <ProviderDot provider={m.provider} />}
                    <span className="font-medium text-ink/90">{m.modelLabel ?? "Seleccionando modelo…"}</span>
                    {m.reason && <span className="hidden sm:inline">· {m.reason}</span>}
                  </div>
                  {m.content ? (
                    <div className={m.status === "streaming" ? "cursor-blink" : ""}>
                      <Markdown
                        content={m.content}
                        onDownloadCode={
                          m.status === "ok" && !m.id.startsWith("tmp")
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

                  {m.status === "ok" && !m.id.startsWith("tmp") && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted opacity-100 transition sm:opacity-60 sm:group-hover:opacity-100">
                      <button
                        onClick={() => navigator.clipboard.writeText(m.content)}
                        className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-panel-2 hover:text-ink"
                      >
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
                      <span className="ml-1 tabular-nums">
                        {m.tokens?.toLocaleString("es-ES")} tokens · {usd(m.costUsd)}
                      </span>
                    </div>
                  )}
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
            <div
              className={`mb-2 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                notice.tone === "error" ? "border-bad/30 bg-bad/10 text-bad" : "border-accent/30 bg-accent/10 text-ink"
              }`}
            >
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} className="text-muted hover:text-ink">✕</button>
            </div>
          )}

          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pending.map((p) => (
                <span
                  key={p.localId}
                  className={`badge py-1 ${p.error ? "border-bad/40 text-bad" : ""}`}
                  title={p.error ?? (p.chars ? `${p.chars.toLocaleString("es-ES")} caracteres extraídos` : "")}
                >
                  <IconFile width={12} height={12} />
                  <span className="max-w-[180px] truncate">{p.filename}</span>
                  {p.uploading ? <span>· leyendo…</span> : p.error ? <span>· {p.error}</span> : <span>· listo</span>}
                  <button onClick={() => setPending((all) => all.filter((x) => x.localId !== p.localId))} className="ml-0.5 hover:text-ink">
                    ✕
                  </button>
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
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-ink"
              title={`Adjuntar documentos (${allowedExtensions})`}
            >
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
              placeholder="Escribe tu mensaje… (Mayús+Intro para nueva línea)"
              className="max-h-64 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted/70"
            />
            {streaming ? (
              <button onClick={() => abortRef.current?.abort()} className="btn-ghost size-10 p-0" title="Detener">
                <IconStop />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim() || models.length === 0}
                className="btn-primary size-10 p-0"
                title="Enviar"
              >
                <IconSend />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            Las respuestas de la IA pueden contener errores. Verifica la información importante.
          </p>
        </div>
      </div>
    </div>
  );
}
