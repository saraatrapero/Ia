import { z } from "zod";
import { pickReviewer } from "@/lib/ai/router";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { buildHistory, guard, ndjsonResponse, runModel } from "@/lib/chat/engine";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ messageId: z.string(), modelId: z.string().optional() });

const REVIEW_PROMPT = `Actúa como revisor independiente de la última respuesta del asistente en esta conversación.
1. Señala errores, imprecisiones u omisiones importantes (cita la frase concreta).
2. Indica qué partes son correctas y fiables.
3. Si algo depende de datos que no puedes comprobar, dilo.
4. Termina con una valoración breve: «Fiable», «Fiable con matices» o «No fiable», y la corrección propuesta si procede.
No repitas la respuesta original; céntrate en la revisión.`;

/** Segunda opinión: otro modelo (preferiblemente de otro proveedor) revisa una respuesta. */
export async function POST(req: Request) {
  try {
    const user = await apiUser("chat.use");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Petición no válida.");
    const original = await db.message.findFirst({
      where: { id: parsed.data.messageId, role: "assistant", status: "ok", conversation: { userId: user.id } },
    });
    if (!original) throw new HttpError(404, "Respuesta no encontrada.");
    const { models, system } = await guard(user);
    const reviewer = parsed.data.modelId
      ? models.find((m) => m.id === parsed.data.modelId)
      : pickReviewer(original.provider ?? "", models);
    if (!reviewer) throw new HttpError(400, "No hay ningún modelo disponible para revisar.");

    // Historial hasta la respuesta revisada (incluida aunque fuera una variante no elegida)
    const { turns } = await buildHistory(original.conversationId, original.createdAt);
    if (!turns.length || turns[turns.length - 1].role !== "assistant" || !original.selected) {
      turns.push({ role: "assistant", content: original.content });
    }
    turns.push({ role: "user", content: REVIEW_PROMPT });

    return ndjsonResponse(async (send) => {
      send({ type: "meta", model: reviewer.id, modelLabel: reviewer.label, provider: reviewer.provider, reviewOf: original.id });
      const r = await runModel({
        user,
        conversationId: original.conversationId,
        model: reviewer,
        system,
        turns,
        signal: req.signal,
        onDelta: (text) => send({ type: "delta", text }),
        source: "review",
        message: { kind: "review", variantGroup: original.id, selected: original.selected, routingReason: "Segunda opinión" },
      });
      if (r.ok) send({ type: "done", messageId: r.message.id, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, free: reviewer.free });
      else if (!r.aborted) send({ type: "error", message: r.error });
    });
  } catch (err) {
    return errorResponse(err);
  }
}
