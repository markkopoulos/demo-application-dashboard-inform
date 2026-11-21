import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  res.status(db === "ok" ? 200 : 503).json({ status: db === "ok" ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
});
