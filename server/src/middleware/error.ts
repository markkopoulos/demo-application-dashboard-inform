import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

// Safe error responses: internal details are logged, never returned.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: { code: "CONFLICT", message: "A record with these details already exists" } });
    if (err.code === "P2025") return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  }
  if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Malformed JSON body" } });
  }
  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
}
