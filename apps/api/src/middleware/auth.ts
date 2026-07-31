import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@wazenly/db";
import { ROLES_HIERARCHY } from "@wazenly/shared";

export interface AuthRequest extends Request {
  userId?: string;
  workspaceId?: string;
  role?: string;
  isSuperAdmin?: boolean;
  isImpersonating?: boolean;
  impersonationMode?: "READ_ONLY" | "FULL";
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET || "secret") as {
      sub: string;
      workspaceId?: string;
      tokenVersion?: number;
      impersonation?: { workspaceId: string; mode: "READ_ONLY" | "FULL" };
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, isSuperAdmin: true, suspendedAt: true },
    });
    if (!user) return res.status(401).json({ error: "Invalid token" });
    if ((payload.tokenVersion || 0) !== user.tokenVersion) {
      return res.status(401).json({ error: "TOKEN_REVOKED", message: "Your session has been signed out. Please log in again." });
    }
    if (user.suspendedAt) {
      return res.status(403).json({ error: "USER_SUSPENDED", message: "Your account has been suspended." });
    }

    req.userId = payload.sub;
    req.isSuperAdmin = user.isSuperAdmin;
    if (payload.impersonation) {
      req.isImpersonating = true;
      req.impersonationMode = payload.impersonation.mode;
      req.workspaceId = payload.impersonation.workspaceId;
    } else {
      req.workspaceId = payload.workspaceId;
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "API key required" });

  const keyHash = require("crypto").createHash("sha256").update(token).digest("hex");
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return res.status(401).json({ error: "Invalid or revoked API key" });
  }
  if (apiKey.workspace.status === "SUSPENDED") {
    return res.status(403).json({ error: "WORKSPACE_SUSPENDED", message: "This company's account has been suspended." });
  }
  if (apiKey.workspace.status === "DELETED") {
    return res.status(403).json({ error: "WORKSPACE_DELETED", message: "This company's account is no longer active." });
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
  });

  req.workspaceId = apiKey.workspaceId;
  next();
}

export async function requireWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
  const workspaceId = req.headers["x-workspace-id"] as string || req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });

  // Impersonation tokens carry their role directly and skip the membership
  // check entirely -- a Super Admin has no real WorkspaceMember row. The
  // suspension check below is intentionally skipped too, since a Super Admin
  // must be able to open a *suspended* company to review/reactivate it.
  if (req.isImpersonating) {
    req.role = req.impersonationMode === "FULL" ? "OWNER" : "VIEWER";
    req.workspaceId = workspaceId;
    return next();
  }

  if (req.userId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.userId },
      include: { workspace: { select: { status: true } } },
    });
    if (!member) return res.status(403).json({ error: "Access denied to this workspace" });
    if (member.workspace.status === "SUSPENDED") {
      return res.status(403).json({ error: "WORKSPACE_SUSPENDED", message: "This company's account has been suspended." });
    }
    if (member.workspace.status === "DELETED") {
      return res.status(403).json({ error: "WORKSPACE_DELETED", message: "This company's account is no longer active." });
    }
    req.role = member.role;
  }

  req.workspaceId = workspaceId;
  next();
}

export function requireRole(minRole: keyof typeof ROLES_HIERARCHY) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.role as keyof typeof ROLES_HIERARCHY | undefined;
    if (!role || ROLES_HIERARCHY[role] < ROLES_HIERARCHY[minRole]) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}
