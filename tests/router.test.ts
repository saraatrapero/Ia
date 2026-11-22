import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, fallbackOrder, pickForComparison, pickReviewer, routeModel, type RoutableModel } from "../src/lib/ai/router";

const m = (id: string, provider: string, tier: string, strengths: string, free: boolean, price = 1, ctx = 1_000_000, sortOrder = 0): RoutableModel => ({
  id, provider, label: id, tier, strengths, inputPrice: price, outputPrice: price * 4, contextWindow: ctx, free, sortOrder,
});

const FREE = [
  m("gemini-flash", "google", "balanced", "general,long-context,data,writing,fast", true, 0.3, 1_000_000, 0),
  m("groq-gpt-oss", "groq", "advanced", "reasoning,code,analysis", true, 0.15, 128_000, 1),
  m("groq-llama", "groq", "fast", "general,fast,writing", true, 0.6, 128_000, 2),
];
const PAID = [
  m("claude-opus", "anthropic", "advanced", "analysis,code,reasoning,long-context,review", false, 4, 1_000_000, 5),
  m("claude-sonnet", "anthropic", "balanced", "code,writing,analysis,review", false, 2, 1_000_000, 6),
  m("gpt-fast", "openai", "fast", "general,fast,writing", false, 0.4, 400_000, 9),
];
const input = (prompt: string, attachmentChars = 0, historyChars = 0) => ({ prompt, attachmentChars, historyChars });

describe("clasificación de tareas", () => {
  it("detecta programación", () => assert.equal(classify(input("Escribe una función en Python que ordene una lista")), "code"));
  it("detecta análisis", () => assert.equal(classify(input("Analiza los riesgos de este plan de negocio")), "deep"));
  it("detecta redacción", () => assert.equal(classify(input("Redacta un correo para el cliente")), "writing"));
  it("consulta breve", () => assert.equal(classify(input("¿Qué hora es en Tokio?")), "quick"));
  it("documentos adjuntos → datos", () => assert.equal(classify(input("¿Qué dice?", 5000)), "data"));
  it("contexto enorme → largo", () => assert.equal(classify(input("Resume", 500_000)), "long"));
});

describe("selector automático", () => {
  it("programación en gratuitos elige el modelo de código", () => {
    const d = routeModel(input("Corrige este bug de JavaScript"), FREE, "free_only")!;
    assert.equal(d.model.id, "groq-gpt-oss");
  });
  it("consulta breve elige un modelo rápido", () => {
    assert.equal(routeModel(input("Hola, ¿qué tal?"), FREE, "free_only")!.model.id, "groq-llama");
  });
  it("descarta modelos sin contexto suficiente", () => {
    const d = routeModel(input("Corrige el código", 900_000), FREE, "free_only")!;
    assert.equal(d.model.id, "gemini-flash");
    assert.match(d.reason, /se descartan/);
  });
  it("en modo calidad prefiere Claude para análisis", () => {
    assert.equal(routeModel(input("Analiza en profundidad la estrategia"), [...FREE, ...PAID], "quality")!.model.id, "claude-opus");
  });
  it("en modo económico prefiere gratuitos aunque haya de pago", () => {
    assert.equal(routeModel(input("Analiza en profundidad la estrategia"), [...FREE, ...PAID], "economic")!.model.free, true);
  });
  it("sin modelos devuelve null", () => assert.equal(routeModel(input("hola"), [], "free_only"), null));
});

describe("respaldo, revisión y comparación", () => {
  it("el respaldo prueba antes otro proveedor", () => {
    const order = fallbackOrder(FREE[1], FREE, new Set(["groq-gpt-oss"]));
    assert.equal(order[0].provider, "google");
    assert.deepEqual(order.map((x) => x.id), ["gemini-flash", "groq-llama"]);
  });
  it("con un solo proveedor, el respaldo usa otro modelo del mismo", () => {
    const solo = [FREE[0], m("gemini-lite", "google", "fast", "general,fast", true, 0.1, 1_000_000, 3)];
    assert.deepEqual(fallbackOrder(solo[0], solo, new Set(["gemini-flash"])).map((x) => x.id), ["gemini-lite"]);
  });
  it("el revisor es de otro proveedor", () => {
    assert.notEqual(pickReviewer("google", [...FREE, ...PAID])!.provider, "google");
  });
  it("la comparación usa proveedores distintos", () => {
    const picks = pickForComparison(input("Explica la inflación"), [...FREE, ...PAID], "quality", 3);
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks.map((p) => p.provider)).size, 3);
  });
});
