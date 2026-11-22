import { z } from "zod";
import { pickForComparison } from "@/lib/ai/router";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { buildHistory, getOrCreateConversation, guard, ndjsonResponse, runModel, saveUserMessage } from "@/lib/chat/engine";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().nullish(),
  message: z.string().trim().min(1, "Escribe un mensaje.").max(200_000),
  /** Vacío = elección automática de modelos de proveedores distintos */
  modelIds: z.array(z.string()).max(3).default([]),
  attachmentIds: z.array(z.string()).max(20).default([]),
});

/** Comparación simultánea: la misma petición a 2-3 modelos en paralelo. */
export async function POST(req: Request) {
  try {
    const user = await apiUser("chat.use");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Petición no válida.");
    const { message, modelIds, attachmentIds } = parsed.data;
    const { models, mode, system } = await guard(user);
    if (models.length < 2) throw new HttpError(400, "Para comparar hacen falta al menos dos modelos disponibles.");

    const { conversation, isNew } = await getOrCreateConversation(user.id, parsed.data.conversationId, message, "compare");
    const userMsg = await saveUserMessage(user.id, conversation.id, message, attachmentIds);
    const { turns, attachmentChars, historyChars } = await buildHistory(conversation.id);

    let chosen = modelIds.length
      ? modelIds.map((id) => models.find((m) => m.id === id)).filter((m): m is (typeof models)[number] => Boolean(m))
      : pickForComparison({ prompt: message, attachmentChars, historyChars }, models, mode, 3);
    chosen = chosen.filter((m, i) => chosen.findIndex((x) => x.id === m.id) === i);
    if (chosen.length < 2) throw new HttpError(400, "Elige al menos dos modelos disponibles para comparar.");

    return ndjsonResponse(async (send) => {
      send({
        type: "meta",
        conversationId: conversation.id,
        userMessageId: userMsg.id,
        isNew,
        slots: chosen.map((m) => ({ model: m.id, modelLabel: m.label, provider: m.provider })),
      });
      const results = await Promise.all(
        chosen.map((model, slot) =>
          runModel({
            user,
            conversationId: conversation.id,
            model,
            system,
            turns,
            signal: req.signal,
            onDelta: (text) => send({ type: "delta", slot, text }),
            source: "compare",
            message: { kind: "compare", variantGroup: userMsg.id, selected: false, routingReason: "Comparación de modelos" },
          }).then((r) => {
            if (r.ok) send({ type: "done", slot, messageId: r.message.id, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, free: model.free });
            else if (!r.aborted) send({ type: "error", slot, message: r.error });
            return r;
          }),
        ),
      );
      // Por defecto se continúa la conversación con la primera respuesta correcta
      const first = results.find((r) => r.ok);
      if (first && first.ok) {
        await db.message.update({ where: { id: first.message.id }, data: { selected: true } });
        send({ type: "selected", messageId: first.message.id });
      }
    });
  } catch (err) {
    return errorResponse(err);
  }
}
