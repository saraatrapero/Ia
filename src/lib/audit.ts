import { db } from "./db";

export async function audit(
  userId: string | null,
  action: string,
  opts: { target?: string; details?: Record<string, unknown> | string; ip?: string | null } = {},
) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        target: opts.target,
        details: typeof opts.details === "string" ? opts.details : opts.details ? JSON.stringify(opts.details) : null,
        ip: opts.ip ?? null,
      },
    });
  } catch (e) {
    console.error("No se pudo registrar la auditoría", e);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Intento de acceso fallido",
  "auth.logout": "Cierre de sesión",
  "auth.password_changed": "Cambio de contraseña",
  "user.created": "Usuario creado",
  "user.updated": "Usuario modificado",
  "user.password_reset": "Contraseña restablecida",
  "user.sessions_revoked": "Sesiones revocadas",
  "department.created": "Departamento creado",
  "model.updated": "Modelo modificado",
  "settings.updated": "Configuración de seguridad modificada",
  "file.uploaded": "Documento subido",
  "file.generated": "Archivo generado",
  "conversation.deleted": "Conversación eliminada",
  "agent.created": "Agente creado",
  "agent.updated": "Agente modificado",
  "budget.blocked": "Petición bloqueada por presupuesto",
};
