import { audit } from "@/lib/audit";
import { apiUser, clientInfo, errorResponse, HttpError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { extractText, MIME_BY_EXT } from "@/lib/files/extract";
import { extOf, sanitizeFilename, saveFile } from "@/lib/files/storage";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings, num } from "@/lib/settings";

export const runtime = "nodejs";

/** Límite de texto por documento (~375.000 tokens). Por encima se rechaza en vez de recortar en silencio. */
const MAX_DOC_CHARS = 1_500_000;

export async function POST(req: Request) {
  try {
    const user = await apiUser("files.upload");
    if (!rateLimit(`upload:${user.id}`, 30)) throw new HttpError(429, "Demasiadas subidas seguidas.");
    const settings = await getSettings();
    const maxMb = num(settings.max_upload_mb) ?? 25;
    const allowed = settings.allowed_extensions.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No se ha recibido ningún archivo.");
    const filename = sanitizeFilename(file.name);
    const ext = extOf(filename);
    if (!allowed.includes(ext) || !MIME_BY_EXT[ext])
      throw new HttpError(415, `Formato no permitido. Permitidos: ${allowed.join(", ")}.`);
    if (file.size > maxMb * 1024 * 1024) throw new HttpError(413, `El archivo supera el máximo de ${maxMb} MB.`);

    const buf = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      text = await extractText(buf, ext);
    } catch (e) {
      console.error(e);
      throw new HttpError(422, "No se ha podido leer el contenido del documento. ¿Está dañado o protegido con contraseña?");
    }
    if (!text) throw new HttpError(422, "El documento no contiene texto legible (puede ser un PDF escaneado sin OCR).");
    if (text.length > MAX_DOC_CHARS)
      throw new HttpError(413, `El documento es demasiado extenso (${text.length.toLocaleString("es-ES")} caracteres; máximo ${MAX_DOC_CHARS.toLocaleString("es-ES")}). Divídelo en partes.`);

    const storagePath = await saveFile("uploads", buf, ext);
    const att = await db.attachment.create({
      data: {
        userId: user.id,
        filename,
        mimeType: MIME_BY_EXT[ext],
        size: file.size,
        storagePath,
        extractedText: text,
        charCount: text.length,
      },
    });
    const { ip } = await clientInfo();
    await audit(user.id, "file.uploaded", { target: att.id, details: { filename, size: file.size }, ip });
    return Response.json({ id: att.id, filename, size: file.size, charCount: text.length });
  } catch (err) {
    return errorResponse(err);
  }
}
