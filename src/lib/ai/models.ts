import { db } from "../db";
import { hasRole } from "../permissions";
import type { ProviderId } from "./catalog";
import { ensureCatalog } from "./ensure-catalog";
import { PROVIDERS } from "./providers";
import type { CostMode } from "./router";
import { getSetting } from "../settings";

/** Modelos que este usuario puede usar ahora mismo (activos, rol suficiente y proveedor configurado). */
export async function availableModels(role: string) {
  await ensureCatalog();
  const mode = (await getSetting("cost_mode")) as CostMode;
  const models = await db.aiModel.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  return models.filter(
    (m) =>
      hasRole(role, m.minRole) &&
      PROVIDERS[m.provider as ProviderId]?.isConfigured() &&
      (mode !== "free_only" || m.free),
  );
}

export async function costMode(): Promise<CostMode> {
  const v = await getSetting("cost_mode");
  return v === "economic" || v === "quality" ? v : "free_only";
}
