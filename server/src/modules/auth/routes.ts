import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { parse } from "../../lib/validate.js";
import { burnPasswordCheck, hashPassword, passwordSchemaRules, verifyPassword } from "../../lib/password.js";
import { clearSessionCookie, createSession, setSessionCookie } from "../../lib/session.js";
import { hashToken, randomToken } from "../../lib/crypto.js";
import { audit } from "../../lib/audit.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../lib/errors.js";
import { loginLimiter, passwordResetLimiter } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { buildMe } from "../me/service.js";

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(passwordSchemaRules.min).max(passwordSchemaRules.max);

const LoginBody = z.object({ email, password: z.string().min(1).max(passwordSchemaRules.max) });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const body = parse(LoginBody, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  if (!user) {
    await burnPasswordCheck(body.password);
    throw unauthorized("Invalid email or password");
  }
  if (!(await verifyPassword(user.passwordHash, body.password))) {
    await audit({ action: "auth.login_failed", actorId: user.id, ip: req.ip });
    throw unauthorized("Invalid email or password");
  }
  // Check status only after the password is verified so we don't leak account state.
  if (user.status !== "ACTIVE") throw forbidden("This account is not active. Please contact your tutoring center.");

  const { token, session } = await createSession(user.id, req);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  setSessionCookie(res, token);
  await audit({ action: "auth.login", actorId: user.id, centerId: session.activeCenterId, ip: req.ip });

  res.json(await buildMe(session.id));
});

authRouter.post("/logout", async (req, res) => {
  if (req.auth) {
    await prisma.session.delete({ where: { id: req.auth.sessionId } }).catch(() => {});
    await audit({ action: "auth.logout", actorId: req.auth.user.id, ip: req.ip });
  }
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await buildMe(req.auth!.sessionId));
});

const SwitchBody = z.object({ centerId: z.string().min(1).max(64) });

authRouter.post("/switch-center", requireAuth, async (req, res) => {
  const { centerId } = parse(SwitchBody, req.body);
  const auth = req.auth!;
  const allowed = auth.user.isSuperAdmin
    ? await prisma.tutoringCenter.findUnique({ where: { id: centerId }, select: { id: true } })
    : await prisma.centerMembership.findFirst({
        where: { userId: auth.user.id, centerId, status: "ACTIVE", center: { status: "ACTIVE" } },
        select: { id: true },
      });
  if (!allowed) throw notFound("Center not found");
  await prisma.session.update({ where: { id: auth.sessionId }, data: { activeCenterId: centerId } });
  res.json(await buildMe(auth.sessionId));
});

// ── Password reset ─────────────────────────────────────────────────────────

const RESET_TTL_MS = 30 * 60_000;

authRouter.post("/password/forgot", passwordResetLimiter, async (req, res) => {
  const body = parse(z.object({ email }), req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  let devResetUrl: string | undefined;

  if (user && user.status === "ACTIVE") {
    const token = randomToken(32);
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await audit({ action: "auth.password_reset_requested", actorId: user.id, ip: req.ip });
    const url = `${env.APP_ORIGIN[0] ?? ""}/reset-password?token=${token}`;
    // Email delivery is a planned enhancement. Until then the link is logged in
    // development and returned to the client ONLY outside production.
    if (!env.isProd) {
      devResetUrl = url;
      logger.info({ email: user.email }, `password reset link: ${url}`);
    }
  }
  // Same response whether or not the account exists (no user enumeration).
  res.status(202).json({ ok: true, ...(devResetUrl ? { devResetUrl } : {}) });
});

const ResetBody = z.object({ token: z.string().min(20).max(200), password });

authRouter.post("/password/reset", passwordResetLimiter, async (req, res) => {
  const body = parse(ResetBody, req.body);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest("This reset link is invalid or has expired");

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(body.password) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Revoke every existing session after a reset.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ action: "auth.password_reset", actorId: record.userId, ip: req.ip });
  res.json({ ok: true });
});

const ChangeBody = z.object({ currentPassword: z.string().min(1).max(passwordSchemaRules.max), newPassword: password });

authRouter.post("/password/change", requireAuth, async (req, res) => {
  const body = parse(ChangeBody, req.body);
  const auth = req.auth!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  if (!(await verifyPassword(user.passwordHash, body.currentPassword))) throw badRequest("Current password is incorrect");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } }),
    prisma.session.deleteMany({ where: { userId: user.id, id: { not: auth.sessionId } } }),
  ]);
  await audit({ action: "auth.password_changed", actorId: user.id, ip: req.ip });
  res.json({ ok: true });
});
