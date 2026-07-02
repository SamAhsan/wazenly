export type Role = "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";

export const ROLES_HIERARCHY: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  AGENT: 2,
  VIEWER: 1,
};

export function hasMinRole(role: string | undefined | null, minRole: Role): boolean {
  const level = ROLES_HIERARCHY[(role || "") as Role] || 0;
  return level >= ROLES_HIERARCHY[minRole];
}
