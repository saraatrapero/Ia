import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBlocks, stripInline } from "../src/lib/files/markdown-blocks";

describe("analizador de Markdown para exportar", () => {
  const md = "# Título\n\nTexto con **negrita**.\n\n- uno\n- dos\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```py\nprint(1)\n```";
  const blocks = parseBlocks(md);
  it("reconoce todos los bloques", () => assert.deepEqual(blocks.map((b) => b.type), ["heading", "paragraph", "list", "table", "code"]));
  it("omite la fila separadora de tablas", () => {
    const t = blocks.find((b) => b.type === "table");
    assert.ok(t && t.type === "table");
    assert.deepEqual(t.rows, [["A", "B"], ["1", "2"]]);
  });
  it("conserva el código", () => {
    const c = blocks.find((b) => b.type === "code");
    assert.ok(c && c.type === "code" && c.text === "print(1)" && c.lang === "py");
  });
  it("limpia formato en línea", () => assert.equal(stripInline("**a** _b_ `c` [d](http://x)"), "a b c d (http://x)"));
});
