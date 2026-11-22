import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageDriver as resolveDriver, supabaseServiceKey, supabaseUrl } from "../env";

/**
 * Almacenamiento de archivos con dos controladores:
 *  - "local":    disco del servidor (desarrollo).
 *  - "supabase": Supabase Storage, bucket privado (producción; Vercel no tiene disco permanente).
 * Los nombres en el almacenamiento son siempre aleatorios; el nombre original solo se guarda en la base de datos.
 */
type Kind = "uploads" | "generated";

const DRIVER = resolveDriver();

// ─── Local ────────────────────────────────────────────────────
const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

function resolveLocal(rel: string) {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ruta de archivo no válida");
  return full;
}

// ─── Supabase Storage (API REST) ──────────────────────────────
function sb() {
  const url = supabaseUrl()?.replace(/\/$/, "");
  const key = supabaseServiceKey();
  const bucket = process.env.SUPABASE_BUCKET || "trapero-files";
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el almacenamiento.");
  return { url, bucket, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}

let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  const { url, bucket, headers } = sb();
  const res = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
  if (res.status === 404 || res.status === 400) {
    const created = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    if (!created.ok && created.status !== 409) throw new Error(`No se pudo crear el bucket (${created.status}): ${await created.text()}`);
  } else if (!res.ok) {
    throw new Error(`Supabase Storage no responde (${res.status}): ${await res.text()}`);
  }
  bucketChecked = true;
}

function objectPath(rel: string) {
  if (rel.includes("..") || rel.startsWith("/")) throw new Error("Ruta de archivo no válida");
  return rel.split("/").map(encodeURIComponent).join("/");
}

// ─── API pública ──────────────────────────────────────────────
export async function saveFile(kind: Kind, data: Buffer, ext: string, contentType = "application/octet-stream") {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const rel = `${kind}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}${safeExt ? "." + safeExt : ""}`;

  if (DRIVER === "supabase") {
    await ensureBucket();
    const { url, bucket, headers } = sb();
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath(rel)}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": contentType, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Error al guardar en Supabase Storage (${res.status}): ${await res.text()}`);
    return rel;
  }

  const full = resolveLocal(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return rel;
}

export async function readStored(rel: string): Promise<Buffer> {
  if (DRIVER === "supabase") {
    const { url, bucket, headers } = sb();
    const res = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${objectPath(rel)}`, { headers });
    if (!res.ok) throw new Error(`Archivo no disponible en el almacenamiento (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(resolveLocal(rel));
}

export async function deleteStored(rel: string) {
  try {
    if (DRIVER === "supabase") {
      const { url, bucket, headers } = sb();
      await fetch(`${url}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [rel] }),
      });
      return;
    }
    await unlink(resolveLocal(rel));
  } catch {
    /* ya no existe */
  }
}

export function storageDriver() {
  return DRIVER === "supabase" ? "Supabase Storage" : "Disco local";
}

export function extOf(filename: string) {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

export function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) || "archivo";
}
