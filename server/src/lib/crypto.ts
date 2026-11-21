import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

// Session / reset tokens are stored hashed so a DB leak doesn't yield live tokens.
// HMAC with the server secret adds a second factor an attacker would need.
export const hashToken = (token: string) => createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};
