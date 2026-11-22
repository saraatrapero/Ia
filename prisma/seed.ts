import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_MODELS } from "../src/lib/ai/catalog";

const db = new PrismaClient();

async function main() {
  // Modelos: se crean si no existen; no se sobrescriben cambios hechos desde el panel.
  for (const [i, m] of DEFAULT_MODELS.entries()) {
    await db.aiModel.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        provider: m.provider,
        apiModel: m.apiModel,
        label: m.label,
        description: m.description,
        tier: m.tier,
        strengths: m.strengths.join(","),
        inputPrice: m.inputPrice,
        outputPrice: m.outputPrice,
        contextWindow: m.contextWindow,
        minRole: m.minRole ?? "MEMBER",
        sortOrder: i,
      },
    });
  }
  console.log(`✓ ${DEFAULT_MODELS.length} modelos en el catálogo`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("⚠ ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se crea el administrador.");
    return;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres.");

  const existing = await db.user.findUnique({ where: { email } });
  const admin =
    existing ??
    (await db.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME || "Administrador",
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
        monthlyBudgetUsd: null,
      },
    }));
  console.log(existing ? `✓ El administrador ${email} ya existía` : `✓ Administrador creado: ${email}`);

  if ((await db.agent.count()) === 0) {
    await db.agent.createMany({
      data: [
        {
          name: "Resumen diario de documentos",
          description: "Lee los documentos nuevos del día y prepara un resumen ejecutivo.",
          systemPrompt: "Eres un analista. Resume los documentos recibidos en un informe ejecutivo breve.",
          modelId: "claude-sonnet",
          permissionLevel: "read",
          tools: "documents.read",
          createdById: admin.id,
        },
        {
          name: "Borrador de respuestas a clientes",
          description: "Prepara borradores de respuesta que una persona revisa antes de enviar.",
          systemPrompt: "Redacta borradores de respuesta profesionales y cordiales.",
          modelId: "gpt-advanced",
          permissionLevel: "draft",
          tools: "documents.read,files.generate",
          createdById: admin.id,
        },
      ],
    });
    console.log("✓ Agentes de ejemplo creados (desactivados)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
