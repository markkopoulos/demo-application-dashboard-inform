import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { forbidden } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function originAllowed(req: Request): boolean {
  const origin = req.get("origin") ?? (req.get("referer") ? safeOrigin(req.get("referer")!) : undefined);
  // Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE. Requests
  // without one are non-browser clients, which can't ride a victim's cookies.
  if (!origin) return true;
  if (origin === "null") return false;
  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  return origin === selfOrigin || env.APP_ORIGIN.includes(origin);
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "null";
  }
}

/**
 * Two layers of CSRF defence for cookie-authenticated mutations:
 *  1. Origin / Referer must match an allowed origin.
 *  2. Authenticated requests must echo the per-session token in X-CSRF-Token
 *     (synchronizer token pattern). SameSite=Lax cookies are a third layer.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  if (!originAllowed(req)) return next(forbidden("Cross-origin request blocked"));
  if (req.auth) {
    const header = req.get("x-csrf-token");
    if (!header || !safeEqual(header, req.auth.csrfToken)) return next(forbidden("Invalid CSRF token"));
  }
  next();
}
