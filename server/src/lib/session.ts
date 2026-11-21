import type { Request, Response } from "express";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { hashToken, randomToken } from "./crypto.js";

export const SESSION_COOKIE = env.cookieSecure ? "__Host-educore_sid" : "educore_sid";

const idleMs = () => env.SESSION_IDLE_MINUTES * 60_000;
const absoluteMs = () => env.SESSION_ABSOLUTE_HOURS * 3_600_000;

/** Picks the first center where the user has an active membership in an active center. */
export async function defaultCenterFor(userId: string): Promise<string | null> {
  const m = await prisma.centerMembership.findFirst({
    where: { userId, status: "ACTIVE", center: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { centerId: true },
  });
  return m?.centerId ?? null;
}

export async function createSession(userId: string, req: Request) {
  const token = randomToken(32);
  const now = Date.now();
  const session = await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      csrfToken: randomToken(24),
      userId,
      activeCenterId: await defaultCenterFor(userId),
      ip: req.ip ?? null,
      userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
      expiresAt: new Date(now + idleMs()),
      absoluteExpiresAt: new Date(now + absoluteMs()),
    },
  });
  return { token, session };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: absoluteMs(),
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: "lax", path: "/" });
}

/** Extends the idle window. Throttled so we write at most once a minute per session. */
export async function touchSession(sessionId: string, lastSeenAt: Date, absoluteExpiresAt: Date) {
  const now = Date.now();
  if (now - lastSeenAt.getTime() < 60_000) return;
  const expiresAt = new Date(Math.min(now + idleMs(), absoluteExpiresAt.getTime()));
  await prisma.session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date(now), expiresAt } }).catch(() => {});
}

export async function purgeExpiredSessions() {
  const now = new Date();
  await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { absoluteExpiresAt: { lt: now } }] } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
}
