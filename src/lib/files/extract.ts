import "server-only";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};

/** Extrae el texto de un documento para que los modelos puedan analizarlo. */
export async function extractText(buf: Buffer, ext: string): Promise<string> {
  switch (ext) {
    case "pdf": {
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const res = await parser.getText();
        return res.text.trim();
      } finally {
        await parser.destroy();
      }
    }
    case "docx": {
      const res = await mammoth.extractRawText({ buffer: buf });
      return res.value.trim();
    }
    case "xlsx": {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const parts: string[] = [];
      wb.eachSheet((sheet) => {
        parts.push(`## Hoja: ${sheet.name}`);
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const values = (row.values as unknown[]).slice(1).map(cellToString);
          parts.push(values.join("\t"));
        });
      });
      return parts.join("\n").trim();
    }
    case "csv":
    case "txt":
    case "md":
    case "json":
      return buf.toString("utf8").replace(/^﻿/, "").trim();
    default:
      throw new Error(`Formato .${ext} no soportado`);
  }
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellToString(o.result);
    if ("text" in o) return String(o.text);
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((r: { text: string }) => r.text).join("");
    return JSON.stringify(o);
  }
  return String(v);
}
