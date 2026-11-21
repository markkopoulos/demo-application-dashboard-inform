import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const message = { error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." } };
// Tests exercise auth flows many times; give them headroom but keep limiting on.
const scale = env.isTest ? 50 : 1;

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300 * scale,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10 * scale,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Key on IP + email so one attacker can't lock out everyone, and one account
  // can't be brute-forced from a single address.
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? "").toLowerCase().slice(0, 200)}`,
  message,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5 * scale,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message,
});
