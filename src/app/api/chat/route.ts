import type { AiModel } from "@prisma/client";
import { z } from "zod";
import { fallbackOrder, routeModel } from "@/lib/ai/router";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { buildHistory, getOrCreateConversation, guard, ndjsonResponse, runModel, saveUserMessage } from "@/lib/chat/engine";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().nullish(),
  message: z.string().trim().min(1, "Escribe un mensaje.").max(200_000),
  modelMode: z.string().default("auto"),
  attachmentIds: z.array(z.string()).max(20).default([]),
});

export async function POST(req: Request) {
  try {
    const user = await apiUser("chat.use");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Petición no válida.");
    const { message, modelMode, attachmentIds } = parsed.data;
    const { models, mode, system } = await guard(user);

    let manual: AiModel | undefined;
    if (modelMode !== "auto") {
      manual = models.find((m) => m.id === modelMode);
      if (!manual) throw new HttpError(400, "El modelo seleccionado no está disponible (puede estar desactivado o no ser gratuito en el modo de coste actual).");
    }

    const { conversation, isNew } = await getOrCreateConversation(user.id, parsed.data.conversationId, message, modelMode);
    const userMsg = await saveUserMessage(user.id, conversation.id, message, attachmentIds);
    if (conversation.modelMode !== modelMode) await db.conversation.update({ where: { id: conversation.id }, data: { modelMode } });
    const { turns, attachmentChars, historyChars } = await buildHistory(conversation.id);

    let model: AiModel;
    let reason: string;
    if (manual) {
      model = manual;
      reason = "Seleccionado manualmente.";
    } else {
      const d = routeModel({ prompt: message, attachmentChars, historyChars }, models, mode)!;
      model = d.model;
      reason = d.reason;
    }

    return ndjsonResponse(
      async (send) => {
        send({ type: "meta", conversationId: conversation.id, userMessageId: userMsg.id, model: model.id, modelLabel: model.label, provider: model.provider, reason, isNew });
        const tried = new Set<string>();
        while (true) {
          tried.add(model.id);
          const r = await runModel({
            user,
            conversationId: conversation.id,
            model,
            system,
            turns,
            signal: req.signal,
            onDelta: (text) => send({ type: "delta", text }),
            source: "chat",
            message: { routingReason: reason },
          });
          if (r.ok) {
            send({ type: "done", messageId: r.message.id, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, free: model.free, title: conversation.title });
            return;
          }
          // Sustitución automática de proveedor si aún no se había emitido texto
          if (!r.aborted && !r.partial && modelMode === "auto") {
            const next = fallbackOrder(model, models, tried)[0];
            if (next) {
              send({ type: "failover", from: model.label, to: next.label, provider: next.provider, reason: r.error });
              reason = `${reason} · respaldo: ${model.label} falló`;
              model = next;
              continue;
            }
          }
          if (!r.aborted) send({ type: "error", message: r.error });
          return;
        }
      },
      { "X-Conversation-Id": conversation.id },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
