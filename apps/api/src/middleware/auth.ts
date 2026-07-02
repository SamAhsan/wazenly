import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@wazenly/db";
import { ROLES_HIERARCHY } from "@wazenly/shared";

export interface AuthRequest extends Request {
  userId?: string;
  workspaceId?: string;
  role?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET || "secret") as {
      sub: string;
      workspaceId?: string;
    };
    req.userId = payload.sub;
    req.workspaceId = payload.workspaceId;
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

  if (req.userId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.userId },
    });
    if (!member) return res.status(403).json({ error: "Access denied to this workspace" });
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
