import { z } from "zod";
import { audit } from "@/lib/audit";
import { apiUser, errorResponse, HttpError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { EXPORT_FORMATS, renderExport, type ExportFormat } from "@/lib/files/export";
import { sanitizeFilename, saveFile } from "@/lib/files/storage";

export const runtime = "nodejs";

const Body = z.union([
  z.object({ messageId: z.string(), format: z.enum(["docx", "md", "txt", "xlsx", "html"]) }),
  // Bloque de código descargado como archivo
  z.object({ messageId: z.string(), code: z.string().max(2_000_000), filename: z.string().min(1).max(120) }),
]);

export async function POST(req: Request) {
  try {
    const user = await apiUser();
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Petición no válida.");
    const body = parsed.data;

    const msg = await db.message.findFirst({
      where: { id: body.messageId, role: "assistant", conversation: { userId: user.id } },
      include: { conversation: { select: { title: true } } },
    });
    if (!msg) throw new HttpError(404, "Mensaje no encontrado.");

    let data: Buffer;
    let filename: string;
    let mime: string;
    if ("format" in body) {
      const fmt = body.format as ExportFormat;
      try {
        data = await renderExport(fmt, msg.content, msg.conversation.title);
      } catch (e) {
        throw new HttpError(422, e instanceof Error ? e.message : "No se pudo generar el archivo.");
      }
      filename = sanitizeFilename(`${msg.conversation.title.replace(/[¿?¡!]/g, "").trim().slice(0, 60) || "respuesta"}.${fmt}`);
      mime = EXPORT_FORMATS[fmt].mime;
    } else {
      if (!msg.content.includes(body.code.slice(0, 200))) throw new HttpError(400, "El código no pertenece a este mensaje.");
      data = Buffer.from(body.code, "utf8");
      filename = sanitizeFilename(body.filename);
      mime = "text/plain; charset=utf-8";
    }

    const ext = filename.split(".").pop() ?? "txt";
    const storagePath = await saveFile("generated", data, ext, mime);
    const file = await db.generatedFile.create({
      data: { userId: user.id, messageId: msg.id, filename, mimeType: mime, size: data.length, storagePath },
    });
    await audit(user.id, "file.generated", { target: file.id, details: { filename } });
    return Response.json({ id: file.id, filename, url: `/api/files/${file.id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
