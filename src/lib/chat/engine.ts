import "server-only";
import type { AiModel, Message } from "@prisma/client";
import type { ProviderId } from "../ai/catalog";
import { availableModels, costMode } from "../ai/models";
import { costUsd } from "../ai/pricing";
import { PROVIDERS } from "../ai/providers";
import type { CostMode } from "../ai/router";
import { buildSystemPrompt } from "../ai/system-prompt";
import { ProviderError, type ChatTurn } from "../ai/types";
import { audit } from "../audit";
import type { CurrentUser } from "../auth/session";
import { HttpError } from "../auth/session";
import { checkBudget } from "../budget";
import { db } from "../db";
import { withinRateLimit } from "../rate-limit";
import { getSettings, num } from "../settings";

/** Comprobaciones comunes antes de llamar a cualquier modelo. */
export async function guard(user: CurrentUser) {
  const settings = await getSettings();
  const perMinute = num(settings.rate_limit_per_minute) ?? 20;
  if (!(await withinRateLimit(user.id, perMinute))) throw new HttpError(429, "Demasiadas peticiones seguidas. Espera un momento.");
  const blocked = await checkBudget(user);
  if (blocked) {
    await audit(user.id, "budget.blocked", { details: blocked });
    throw new HttpError(402, blocked);
  }
  const models = await availableModels(user.role);
  if (models.length === 0) {
    throw new HttpError(
      503,
      settings.cost_mode === "free_only"
        ? "No hay ningún modelo gratuito disponible. El administrador debe configurar al menos una clave gratuita (Gemini, Groq u OpenRouter)."
        : "No hay ningún modelo disponible. El administrador debe configurar las claves de API y activar modelos.",
    );
  }
  const mode: CostMode = await costMode();
  const system = buildSystemPrompt({ userName: user.name, department: user.department?.name, extra: settings.system_prompt_extra });
  return { settings, models, mode, system };
}

/** Recupera o crea la conversación del usuario. */
export async function getOrCreateConversation(userId: string, conversationId: string | null | undefined, firstMessage: string, modelMode: string) {
  if (conversationId) {
    const c = await db.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!c) throw new HttpError(404, "Conversación no encontrada.");
    return { conversation: c, isNew: false };
  }
  const conversation = await db.conversation.create({
    data: { userId, title: firstMessage.slice(0, 80).replace(/\s+/g, " "), modelMode },
  });
  return { conversation, isNew: true };
}

/** Guarda el mensaje del usuario y le asocia los documentos (solo propios y sin asignar). */
export async function saveUserMessage(userId: string, conversationId: string, content: string, attachmentIds: string[]) {
  const attachments = attachmentIds.length
    ? await db.attachment.findMany({ where: { id: { in: attachmentIds }, userId, messageId: null } })
    : [];
  const msg = await db.message.create({ data: { conversationId, role: "user", content } });
  if (attachments.length) {
    await db.attachment.updateMany({
      where: { id: { in: attachments.map((a) => a.id) } },
      data: { messageId: msg.id, conversationId },
    });
  }
  return msg;
}

function renderUserTurn(content: string, attachments: { filename: string; extractedText: string }[]) {
  if (attachments.length === 0) return content;
  const docs = attachments
    .map((a) => `<documento nombre="${a.filename.replace(/["<>]/g, "'")}">\n${a.extractedText.replace(/<\/documento>/gi, "</ documento>")}\n</documento>`)
    .join("\n\n");
  return `${docs}\n\n${content}`;
}

/**
 * Historial en el formato que esperan los proveedores. Excluye respuestas fallidas y las
 * variantes de comparación no elegidas; fusiona turnos consecutivos del mismo rol.
 */
export async function buildHistory(conversationId: string, upTo?: Date) {
  const history = await db.message.findMany({
    where: {
      conversationId,
      status: { not: "error" },
      selected: true,
      ...(upTo ? { createdAt: { lte: upTo } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { attachments: { select: { filename: true, extractedText: true } } },
  });
  const turns: ChatTurn[] = [];
  let attachmentChars = 0;
  let historyChars = 0;
  for (const m of history) {
    attachmentChars += m.attachments.reduce((a, x) => a + x.extractedText.length, 0);
    historyChars += m.content.length;
    const content = m.role === "user" ? renderUserTurn(m.content, m.attachments) : m.content;
    if (!content.trim()) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else turns.push({ role: m.role as ChatTurn["role"], content });
  }
  while (turns[0]?.role === "assistant") turns.shift();
  return { turns, attachmentChars, historyChars };
}

export type StreamEvent = Record<string, unknown> & { type: string };

/** Crea una respuesta NDJSON a partir de un productor de eventos. */
export function ndjsonResponse(produce: (send: (e: StreamEvent) => void) => Promise<void>, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* el cliente se ha desconectado */
        }
      };
      try {
        await produce(send);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: "Error interno al generar la respuesta." });
      }
      try {
        controller.close();
      } catch {
        /* ya cerrado */
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export interface RunOptions {
  user: CurrentUser;
  conversationId: string;
  model: AiModel;
  system: string;
  turns: ChatTurn[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
  source: "chat" | "compare" | "review";
  /** Datos adicionales para el mensaje guardado */
  message: Partial<Pick<Message, "kind" | "variantGroup" | "selected" | "routingReason">>;
}

export type RunResult =
  | { ok: true; message: Message; inputTokens: number; outputTokens: number; costUsd: number }
  | { ok: false; error: string; aborted: boolean; partial: string };

/**
 * Ejecuta un modelo en streaming, guarda la respuesta y registra el consumo (también los errores).
 * Si falla sin haber emitido texto devuelve ok:false para que el llamador pueda conmutar de proveedor.
 */
/** Si un modelo no empieza a responder en este tiempo se corta y se prueba otro. */
const FIRST_TOKEN_TIMEOUT_MS = 20_000;

export async function runModel(o: RunOptions): Promise<RunResult> {
  let text = "";
  const started = Date.now();
  // Señal propia: se cancela si el usuario detiene o si el modelo no arranca a tiempo
  const ctrl = new AbortController();
  const onUserAbort = () => ctrl.abort();
  o.signal.addEventListener("abort", onUserAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    if (!text) {
      timedOut = true;
      ctrl.abort();
    }
  }, FIRST_TOKEN_TIMEOUT_MS);
  const usageBase = { userId: o.user.id, conversationId: o.conversationId, modelId: o.model.id, provider: o.model.provider, source: o.source };
  try {
    const result = await PROVIDERS[o.model.provider as ProviderId].stream(
      { apiModel: o.model.apiModel, system: o.system, messages: o.turns, signal: ctrl.signal },
      (delta) => {
        text += delta;
        o.onDelta(delta);
      },
    );
    const cost = costUsd(result.inputTokens, result.outputTokens, o.model.inputPrice, o.model.outputPrice, o.model.free);
    const message = await db.message.create({
      data: {
        conversationId: o.conversationId,
        role: "assistant",
        content: text,
        modelId: o.model.id,
        provider: o.model.provider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: cost,
        ...o.message,
      },
    });
    await db.usageRecord.create({
      data: { ...usageBase, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: cost, latencyMs: Date.now() - started, status: "ok" },
    });
    await db.conversation.update({ where: { id: o.conversationId }, data: { updatedAt: new Date() } });
    return { ok: true, message, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: cost };
  } catch (err) {
    const aborted = o.signal.aborted;
    const error = timedOut
      ? `${o.model.label} no empezó a responder en ${FIRST_TOKEN_TIMEOUT_MS / 1000} s (posible saturación).`
      : err instanceof ProviderError
        ? err.message
        : aborted
          ? "Detenido por el usuario."
          : "Error inesperado al contactar con el modelo.";
    if (!(err instanceof ProviderError) && !aborted && !timedOut) console.error(err);
    await db.usageRecord.create({
      data: { ...usageBase, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - started, status: "error", error: error.slice(0, 500) },
    });
    if (text) {
      await db.message.create({
        data: {
          conversationId: o.conversationId,
          role: "assistant",
          content: text,
          modelId: o.model.id,
          provider: o.model.provider,
          status: aborted ? "stopped" : "error",
          ...o.message,
        },
      });
    }
    return { ok: false, error, aborted, partial: text };
  } finally {
    clearTimeout(timer);
    o.signal.removeEventListener("abort", onUserAbort);
  }
}
