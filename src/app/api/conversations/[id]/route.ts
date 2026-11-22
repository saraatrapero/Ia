import { z } from "zod";
import { audit } from "@/lib/audit";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteStored } from "@/lib/files/storage";

export const runtime = "nodejs";

const Patch = z.object({ title: z.string().trim().min(1).max(120).optional(), pinned: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await params;
    const body = Patch.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Datos no válidos.");
    const res = await db.conversation.updateMany({ where: { id, userId: user.id }, data: body.data });
    if (res.count === 0) throw new HttpError(404, "Conversación no encontrada.");
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await params;
    const conv = await db.conversation.findFirst({ where: { id, userId: user.id }, include: { attachments: true } });
    if (!conv) throw new HttpError(404, "Conversación no encontrada.");
    await db.conversation.delete({ where: { id } });
    await Promise.all(conv.attachments.map((a) => deleteStored(a.storagePath)));
    await audit(user.id, "conversation.deleted", { target: id, details: { title: conv.title } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
