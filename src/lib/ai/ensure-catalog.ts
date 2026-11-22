import { db } from "../db";
import { DEFAULT_MODELS } from "./catalog";

let done = false;

/**
 * Añade a la base de datos los modelos del catálogo que aún no existan.
 * No modifica los existentes: los cambios hechos desde el panel se respetan.
 */
export async function ensureCatalog() {
  if (done) return;
  await db.aiModel.createMany({
    data: DEFAULT_MODELS.map((m, i) => ({
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
      free: m.free ?? false,
      vision: m.vision ?? false,
      minRole: m.minRole ?? "MEMBER",
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
  done = true;
}
