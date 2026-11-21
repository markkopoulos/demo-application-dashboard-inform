import express, { Router } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { loadSession } from "./middleware/auth.js";
import { csrfProtection } from "./middleware/csrf.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { healthRouter } from "./modules/health/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { meRouter } from "./modules/me/routes.js";
import { centersRouter } from "./modules/centers/routes.js";
import { overviewRouter } from "./modules/overview/routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Hostinger and most PaaS put a reverse proxy in front: trust one hop so
  // req.ip / req.protocol reflect the client (needed for rate limiting & cookies).
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.cookieSecure ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  if (!env.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));

  const api = Router();
  api.use(express.json({ limit: "1mb" }));
  api.use(cookieParser());
  api.use(apiLimiter);
  api.use("/health", healthRouter);
  api.use(loadSession);
  api.use(csrfProtection);
  api.use("/auth", authRouter);
  api.use("/me", meRouter);
  api.use("/platform/centers", centersRouter);
  api.use("/overview", overviewRouter);
  api.use(notFoundHandler);
  app.use("/api", api);

  // ── Static SPA (production) ───────────────────────────────────────────────
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    // Hashed build assets are cached forever; everything else is revalidated.
    app.use("/assets", express.static(path.join(clientDist, "assets"), { index: false, maxAge: "1y", immutable: true }));
    app.use(express.static(clientDist, { index: false, maxAge: 0 }));
    // SPA fallback for client-side routes (never for /api).
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
