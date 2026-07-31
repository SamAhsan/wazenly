import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
}
