import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Elige qué respuesta de una comparación se usa para continuar la conversación. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser("chat.use");
    const { id } = await params;
    const msg = await db.message.findFirst({ where: { id, kind: "compare", status: "ok", conversation: { userId: user.id } } });
    if (!msg?.variantGroup) throw new HttpError(404, "Respuesta no encontrada.");
    await db.$transaction([
      db.message.updateMany({ where: { variantGroup: msg.variantGroup, kind: "compare" }, data: { selected: false } }),
      db.message.update({ where: { id }, data: { selected: true } }),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
