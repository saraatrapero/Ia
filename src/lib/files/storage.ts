import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

/** Guarda un archivo con nombre aleatorio (nunca usa el nombre del usuario en la ruta). */
export async function saveFile(kind: "uploads" | "generated", data: Buffer, ext: string) {
  const dir = path.join(ROOT, kind, new Date().toISOString().slice(0, 7));
  await mkdir(dir, { recursive: true });
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const full = path.join(dir, `${randomUUID()}${safeExt ? "." + safeExt : ""}`);
  await writeFile(full, data);
  return path.relative(ROOT, full);
}

function resolveSafe(rel: string) {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ruta de archivo no válida");
  return full;
}

export async function readStored(rel: string) {
  return readFile(resolveSafe(rel));
}

export async function deleteStored(rel: string) {
  try {
    await unlink(resolveSafe(rel));
  } catch {
    /* ya no existe */
  }
}

export function extOf(filename: string) {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

export function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) || "archivo";
}
