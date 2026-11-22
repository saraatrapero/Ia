import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";

export type ExportFormat = "docx" | "md" | "txt" | "xlsx" | "html";

export const EXPORT_FORMATS: Record<ExportFormat, { label: string; mime: string }> = {
  docx: { label: "Word (.docx)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { label: "Excel (.xlsx)", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  md: { label: "Markdown (.md)", mime: "text/markdown; charset=utf-8" },
  html: { label: "HTML (.html)", mime: "text/html; charset=utf-8" },
  txt: { label: "Texto (.txt)", mime: "text/plain; charset=utf-8" },
};

// ─── Mini analizador de Markdown por bloques ─────────────────────

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; lang: string; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "quote"; text: string };

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\S*)/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push({ type: "code", lang: fence[1] || "", text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|\s*\||\s*([-*+]|\d+[.)])\s+|>)/.test(lines[i])
    )
      buf.push(lines[i++]);
    blocks.push({ type: "paragraph", text: buf.join(" ") });
  }
  return blocks;
}

function stripInline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*/g, "$1")
    .replace(/(?<![\w])_([^_]+)_(?![\w])/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

/** Convierte **negrita**, *cursiva* y `código` en fragmentos de Word. */
function inlineRuns(s: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|(?<![\w])_[^_]+_(?![\w]))/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) runs.push(new TextRun(stripInline(s.slice(last, m.index))));
    const t = m[0];
    if (t.startsWith("**")) runs.push(new TextRun({ text: t.slice(2, -2), bold: true }));
    else if (t.startsWith("`")) runs.push(new TextRun({ text: t.slice(1, -1), font: "Consolas" }));
    else runs.push(new TextRun({ text: t.slice(1, -1), italics: true }));
    last = m.index! + t.length;
  }
  if (last < s.length) runs.push(new TextRun(stripInline(s.slice(last))));
  return runs;
}

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

async function toDocx(md: string, title: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  for (const b of parseBlocks(md)) {
    switch (b.type) {
      case "heading":
        children.push(new Paragraph({ heading: HEADINGS[b.level - 1], children: inlineRuns(b.text) }));
        break;
      case "paragraph":
        children.push(new Paragraph({ children: inlineRuns(b.text), spacing: { after: 120 } }));
        break;
      case "quote":
        children.push(new Paragraph({ children: inlineRuns(b.text), indent: { left: 480 }, style: "Quote" }));
        break;
      case "list":
        b.items.forEach((item, idx) =>
          children.push(
            new Paragraph({
              children: [new TextRun(b.ordered ? `${idx + 1}. ` : "• "), ...inlineRuns(item)],
              indent: { left: 360 },
            }),
          ),
        );
        break;
      case "code":
        for (const l of b.text.split("\n"))
          children.push(new Paragraph({ children: [new TextRun({ text: l || " ", font: "Consolas", size: 18 })] }));
        children.push(new Paragraph(""));
        break;
      case "table": {
        const border = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.rows.map(
              (r, ri) =>
                new TableRow({
                  tableHeader: ri === 0,
                  children: r.map(
                    (c) =>
                      new TableCell({
                        borders: { top: border, bottom: border, left: border, right: border },
                        children: [new Paragraph({ children: ri === 0 ? [new TextRun({ text: stripInline(c), bold: true })] : inlineRuns(c) })],
                      }),
                  ),
                }),
            ),
          }),
        );
        children.push(new Paragraph(""));
        break;
      }
    }
  }
  const doc = new Document({
    creator: "TRAPERO AI",
    title,
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, children: [new TextRun(title)] }),
          ...children,
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function toXlsx(md: string): Promise<Buffer> {
  const tables = parseBlocks(md).filter((b): b is Extract<Block, { type: "table" }> => b.type === "table");
  if (tables.length === 0) throw new Error("La respuesta no contiene ninguna tabla para exportar a Excel.");
  const wb = new ExcelJS.Workbook();
  wb.creator = "TRAPERO AI";
  tables.forEach((t, idx) => {
    const ws = wb.addWorksheet(`Tabla ${idx + 1}`);
    t.rows.forEach((r, ri) => {
      const row = ws.addRow(
        r.map((c) => {
          const clean = stripInline(c);
          const n = Number(clean.replace(/\./g, "").replace(",", ".").replace(/[€$%\s]/g, ""));
          return ri > 0 && clean !== "" && Number.isFinite(n) && /\d/.test(clean) ? n : clean;
        }),
      );
      if (ri === 0) row.font = { bold: true };
    });
    ws.columns.forEach((col) => (col.width = 20));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(md: string, title: string) {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const body = parseBlocks(md)
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
        case "paragraph":
          return `<p>${inline(b.text)}</p>`;
        case "quote":
          return `<blockquote>${inline(b.text)}</blockquote>`;
        case "list": {
          const tag = b.ordered ? "ol" : "ul";
          return `<${tag}>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${tag}>`;
        }
        case "code":
          return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
        case "table":
          return `<table>${b.rows
            .map((r, ri) => `<tr>${r.map((c) => (ri === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`)
            .join("")}</table>`;
      }
    })
    .join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.6;color:#1a1a1a}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f3f3f3}
pre{background:#f5f5f5;padding:12px;overflow:auto;border-radius:6px}blockquote{border-left:3px solid #ccc;margin:0;padding-left:12px;color:#555}</style>
</head><body><h1>${escapeHtml(title)}</h1>
${body}</body></html>`;
}

export async function renderExport(format: ExportFormat, markdown: string, title: string): Promise<Buffer> {
  switch (format) {
    case "docx":
      return toDocx(markdown, title);
    case "xlsx":
      return toXlsx(markdown);
    case "md":
      return Buffer.from(markdown, "utf8");
    case "html":
      return Buffer.from(toHtml(markdown, title), "utf8");
    case "txt":
      return Buffer.from(
        parseBlocks(markdown)
          .map((b) =>
            b.type === "list"
              ? b.items.map((i, n) => `${b.ordered ? `${n + 1}.` : "-"} ${stripInline(i)}`).join("\n")
              : b.type === "table"
                ? b.rows.map((r) => r.map(stripInline).join("\t")).join("\n")
                : b.type === "code"
                  ? b.text
                  : stripInline(b.text),
          )
          .join("\n\n"),
        "utf8",
      );
  }
}
