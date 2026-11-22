import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readStored } from "@/lib/files/storage";

export const runtime = "nodejs";

/** Descarga de un archivo propio (generado o subido). ?tipo=subido para documentos adjuntos. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser();
    const { id } = await params;
    const kind = new URL(req.url).searchParams.get("tipo");
    const rec =
      kind === "subido"
        ? await db.attachment.findFirst({ where: { id, userId: user.id } })
        : await db.generatedFile.findFirst({ where: { id, userId: user.id } });
    if (!rec) throw new HttpError(404, "Archivo no encontrado.");
    const data = await readStored(rec.storagePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": rec.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(rec.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
