export const ROLES = ["MEMBER", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: "Miembro",
  MANAGER: "Responsable",
  ADMIN: "Administrador",
};

export function roleRank(role: string) {
  const i = ROLES.indexOf(role as Role);
  return i === -1 ? 0 : i;
}

export function hasRole(userRole: string, required: string) {
  return roleRank(userRole) >= roleRank(required);
}

/** Matriz de permisos de la plataforma */
export const PERMISSIONS = {
  "chat.use": "MEMBER",
  "files.upload": "MEMBER",
  "usage.view_own": "MEMBER",
  "usage.view_all": "MANAGER",
  "agents.view": "MEMBER",
  "agents.manage": "ADMIN",
  "users.manage": "ADMIN",
  "models.manage": "ADMIN",
  "security.manage": "ADMIN",
  "audit.view": "ADMIN",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(userRole: string, perm: Permission) {
  return hasRole(userRole, PERMISSIONS[perm]);
}
