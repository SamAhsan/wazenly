import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error("[Error]", err.message, err.stack);

  if (err.name === "ZodError") {
    return res.status(422).json({ error: "Validation error", details: JSON.parse(err.message) });
  }

  if (err.name === "PrismaClientKnownRequestError") {
    return res.status(409).json({ error: "Database conflict" });
  }

  res.status(500).json({ error: "Internal server error" });
}
