/**
 * Inicialización opcional desde terminal (en producción se usa la página /setup).
 * Crea el catálogo de modelos y, si se definen ADMIN_EMAIL y ADMIN_PASSWORD, el administrador.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { ensureCatalog } from "../src/lib/ai/ensure-catalog";
import { db } from "../src/lib/db";

async function main() {
  await ensureCatalog();
  console.log(`✓ Catálogo de modelos: ${await db.aiModel.count()} modelos`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ℹ Sin ADMIN_EMAIL/ADMIN_PASSWORD: crea el administrador desde /setup.");
    return;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres.");
  if (await db.user.findUnique({ where: { email } })) {
    console.log(`✓ El administrador ${email} ya existía`);
    return;
  }
  await db.user.create({
    data: { email, name: process.env.ADMIN_NAME || "Administrador", passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
  });
  console.log(`✓ Administrador creado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
