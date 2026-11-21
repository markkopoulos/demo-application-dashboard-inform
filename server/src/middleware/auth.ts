import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/crypto.js";
import { SESSION_COOKIE, clearSessionCookie, touchSession } from "../lib/session.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export interface AuthContext {
  sessionId: string;
  csrfToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    locale: string;
    isSuperAdmin: boolean;
  };
  /** Effective role in the active center (SUPER_ADMIN for platform admins); null when the user has no usable membership. */
  role: Role | null;
  /** Active tutoring center. Null for a super admin who hasn't picked one, or a user without memberships. */
  centerId: string | null;
}

export type CenterAuthContext = AuthContext & { centerId: string };

/**
 * Resolves the session cookie into req.auth. Never throws for anonymous requests;
 * route guards below decide what is required. The role is ALWAYS derived from the
 * database — nothing the client sends influences it.
 */
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return next();

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  const now = new Date();

  if (!session || session.expiresAt < now || session.absoluteExpiresAt < now || session.user.status !== "ACTIVE") {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    clearSessionCookie(res);
    return next();
  }

  const { user } = session;
  const isSuperAdmin = user.platformRole === "SUPER_ADMIN";
  let role: Role | null = isSuperAdmin ? "SUPER_ADMIN" : null;
  let centerId: string | null = null;

  if (session.activeCenterId) {
    if (isSuperAdmin) {
      const center = await prisma.tutoringCenter.findUnique({ where: { id: session.activeCenterId }, select: { id: true } });
      centerId = center?.id ?? null;
    } else {
      const membership = await prisma.centerMembership.findUnique({
        where: { userId_centerId: { userId: user.id, centerId: session.activeCenterId } },
        include: { center: { select: { status: true } } },
      });
      if (membership && membership.status === "ACTIVE" && membership.center.status === "ACTIVE") {
        role = membership.role;
        centerId = membership.centerId;
      }
    }
  }

  // A non-admin user with no usable membership is authenticated but has no role.
  // We still attach the context so /me can explain the situation, but every
  // role-guarded route will reject them.
  req.auth = {
    sessionId: session.id,
    csrfToken: session.csrfToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      isSuperAdmin,
    },
    role,
    centerId,
  };

  await touchSession(session.id, session.lastSeenAt, session.absoluteExpiresAt);
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

/** Allows only the listed roles. SUPER_ADMIN is NOT implicitly included. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!req.auth.role || !roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}

/** Requires an active center context (all center-scoped routes). */
export function requireCenter(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (!req.auth.centerId) return next(forbidden("No active tutoring center"));
  next();
}

/** Narrowing helper for handlers that run after requireCenter. */
export function centerCtx(req: Request): CenterAuthContext {
  const a = req.auth;
  if (!a?.centerId) throw forbidden("No active tutoring center");
  return a as CenterAuthContext;
}
