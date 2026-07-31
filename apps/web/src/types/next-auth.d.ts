import "next-auth";
import "next-auth/jwt";

interface Impersonating {
  workspaceId: string;
  companyName: string;
  mode: "READ_ONLY" | "FULL";
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    workspaceId?: string;
    role?: string;
    isSuperAdmin?: boolean;
    // null is a deliberate "clear this" signal distinct from undefined ("don't
    // touch this field") -- see the jwt callback's trigger === "update" branch.
    impersonating?: Impersonating | null;
    superAdminAccessToken?: string | null;
    superAdminWorkspaceId?: string | null;
    superAdminRole?: string | null;
  }
  interface User {
    accessToken?: string;
    workspaceId?: string;
    role?: string;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    workspaceId?: string;
    role?: string;
    roleCheckedAt?: number;
    isSuperAdmin?: boolean;
    impersonating?: Impersonating | null;
    superAdminAccessToken?: string | null;
    superAdminWorkspaceId?: string | null;
    superAdminRole?: string | null;
  }
}
