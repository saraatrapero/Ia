import type { AiModel } from "@prisma/client";
import { z } from "zod";
import { availableModels } from "@/lib/ai/models";
import { costUsd } from "@/lib/ai/pricing";
import { PROVIDERS } from "@/lib/ai/providers";
import { routeModel } from "@/lib/ai/router";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { ProviderError, type ChatTurn } from "@/lib/ai/types";
import type { ProviderId } from "@/lib/ai/catalog";
import { audit } from "@/lib/audit";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { checkBudget } from "@/lib/budget";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings, num } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  conversationId: z.string().nullish(),
  message: z.string().trim().min(1, "Escribe un mensaje.").max(200_000),
  modelMode: z.string().default("auto"),
  attachmentIds: z.array(z.string()).max(20).default([]),
});

type Event =
  | { type: "meta"; conversationId: string; userMessageId: string; model: string; modelLabel: string; provider: string; reason: string }
  | { type: "delta"; text: string }
  | { type: "failover"; from: string; to: string; reason: string }
  | { type: "done"; messageId: string; inputTokens: number; outputTokens: number; costUsd: number; title: string }
  | { type: "error"; message: string };

function renderTurn(content: string, attachments: { filename: string; extractedText: string }[]) {
  if (attachments.length === 0) return content;
  const docs = attachments
    .map((a) => `<documento nombre="${a.filename.replace(/"/g, "'")}">\n${a.extractedText}\n</documento>`)
    .join("\n\n");
  return `${docs}\n\n${content}`;
}

export async function POST(req: Request) {
  try {
    const user = await apiUser("chat.use");
    const settings = await getSettings();

    const perMinute = num(settings.rate_limit_per_minute) ?? 20;
    if (!rateLimit(`chat:${user.id}`, perMinute)) throw new HttpError(429, "Demasiadas peticiones seguidas. Espera un momento.");

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Petición no válida.");
    const { message, modelMode, attachmentIds } = parsed.data;

    const blocked = await checkBudget(user);
    if (blocked) {
      await audit(user.id, "budget.blocked", { details: blocked });
      throw new HttpError(402, blocked);
    }

    const models = await availableModels(user.role);
    if (models.length === 0)
      throw new HttpError(503, "No hay ningún modelo disponible. El administrador debe configurar las claves de API y activar modelos.");

    // Conversación
    let conversation = parsed.data.conversationId
      ? await db.conversation.findFirst({ where: { id: parsed.data.conversationId, userId: user.id } })
      : null;
    if (parsed.data.conversationId && !conversation) throw new HttpError(404, "Conversación no encontrada.");
    const isNew = !conversation;
    conversation ??= await db.conversation.create({
      data: { userId: user.id, title: message.slice(0, 80).replace(/\s+/g, " "), modelMode },
    });

    // Adjuntos: solo del propio usuario y aún sin asignar a un mensaje
    const attachments = attachmentIds.length
      ? await db.attachment.findMany({ where: { id: { in: attachmentIds }, userId: user.id, messageId: null } })
      : [];

    const userMsg = await db.message.create({
      data: { conversationId: conversation.id, role: "user", content: message },
    });
    if (attachments.length)
      await db.attachment.updateMany({
        where: { id: { in: attachments.map((a) => a.id) } },
        data: { messageId: userMsg.id, conversationId: conversation.id },
      });

    // Historial completo con documentos
    const history = await db.message.findMany({
      where: { conversationId: conversation.id, status: { not: "error" } },
      orderBy: { createdAt: "asc" },
      include: { attachments: { select: { filename: true, extractedText: true } } },
    });
    const turns: ChatTurn[] = [];
    for (const m of history) {
      const content = m.role === "user" ? renderTurn(m.content, m.attachments) : m.content;
      if (!content.trim()) continue;
      const last = turns[turns.length - 1];
      // Los proveedores exigen alternancia usuario/asistente: se fusionan turnos consecutivos.
      if (last && last.role === m.role) last.content += "\n\n" + content;
      else turns.push({ role: m.role as ChatTurn["role"], content });
    }
    if (turns[0]?.role === "assistant") turns.shift();

    // Selección de modelo
    const attachmentChars = history.reduce((s, m) => s + m.attachments.reduce((a, x) => a + x.extractedText.length, 0), 0);
    const historyChars = history.reduce((s, m) => s + m.content.length, 0);
    let chosen: AiModel;
    let reason: string;
    if (modelMode === "auto") {
      const d = routeModel({ prompt: message, attachmentChars, historyChars }, models)!;
      chosen = d.model;
      reason = d.reason;
    } else {
      const m = models.find((x) => x.id === modelMode);
      if (!m) throw new HttpError(400, "El modelo seleccionado no está disponible para tu usuario.");
      chosen = m;
      reason = "Seleccionado manualmente.";
    }
    if (conversation.modelMode !== modelMode)
      await db.conversation.update({ where: { id: conversation.id }, data: { modelMode } });

    const system = buildSystemPrompt({
      userName: user.name,
      department: user.department?.name,
      extra: settings.system_prompt_extra,
    });

    const conversationId = conversation.id;
    const title = conversation.title;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: Event) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
          } catch {
            /* el cliente se ha desconectado */
          }
        };
        let text = "";
        let model = chosen;
        const tried = new Set<string>();

        send({ type: "meta", conversationId, userMessageId: userMsg.id, model: model.id, modelLabel: model.label, provider: model.provider, reason });

        while (true) {
          tried.add(model.id);
          const started = Date.now();
          try {
            const result = await PROVIDERS[model.provider as ProviderId].stream(
              { apiModel: model.apiModel, system, messages: turns, signal: req.signal },
              (delta) => {
                text += delta;
                send({ type: "delta", text: delta });
              },
            );
            const cost = costUsd(result.inputTokens, result.outputTokens, model.inputPrice, model.outputPrice);
            const saved = await db.message.create({
              data: {
                conversationId,
                role: "assistant",
                content: text,
                modelId: model.id,
                provider: model.provider,
                routingReason: reason,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                costUsd: cost,
              },
            });
            await db.usageRecord.create({
              data: {
                userId: user.id,
                conversationId,
                modelId: model.id,
                provider: model.provider,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                costUsd: cost,
                latencyMs: Date.now() - started,
                status: "ok",
              },
            });
            await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
            send({ type: "done", messageId: saved.id, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: cost, title });
            break;
          } catch (err) {
            const aborted = req.signal.aborted;
            const msg = err instanceof ProviderError ? err.message : aborted ? "Detenido por el usuario." : "Error inesperado al contactar con el modelo.";
            if (!(err instanceof ProviderError) && !aborted) console.error(err);

            await db.usageRecord.create({
              data: {
                userId: user.id,
                conversationId,
                modelId: model.id,
                provider: model.provider,
                inputTokens: 0,
                outputTokens: 0,
                costUsd: 0,
                latencyMs: Date.now() - started,
                status: "error",
                error: msg.slice(0, 500),
              },
            });

            // Conmutación automática a otro proveedor si aún no se ha emitido texto
            if (!aborted && text === "" && modelMode === "auto") {
              const next =
                models.find((m) => !tried.has(m.id) && m.provider !== model.provider && m.tier === model.tier) ??
                models.find((m) => !tried.has(m.id) && m.provider !== model.provider);
              if (next) {
                send({ type: "failover", from: model.label, to: next.label, reason: msg });
                reason = `${reason} (respaldo: ${model.label} no respondió)`;
                model = next;
                continue;
              }
            }

            if (text) {
              await db.message.create({
                data: {
                  conversationId,
                  role: "assistant",
                  content: text,
                  modelId: model.id,
                  provider: model.provider,
                  routingReason: reason,
                  status: aborted ? "stopped" : "error",
                },
              });
            }
            if (!aborted) send({ type: "error", message: msg });
            break;
          }
        }
        try {
          controller.close();
        } catch {
          /* el cliente ya cerró */
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": conversationId,
        "X-New-Conversation": isNew ? "1" : "0",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
