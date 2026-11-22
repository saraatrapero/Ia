import { db } from "../db";
import { hasRole } from "../permissions";
import { PROVIDERS } from "./providers";
import type { ProviderId } from "./catalog";

/** Modelos que este usuario puede usar ahora mismo (activos, rol suficiente y proveedor configurado). */
export async function availableModels(role: string) {
  const models = await db.aiModel.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  return models.filter((m) => hasRole(role, m.minRole) && PROVIDERS[m.provider as ProviderId]?.isConfigured());
}
