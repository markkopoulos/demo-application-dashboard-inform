/** Platform administration — SUPER_ADMIN only. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { parse } from "../../lib/validate.js";
import { requireRole } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { conflict, notFound } from "../../lib/errors.js";
import { hashPassword, passwordSchemaRules } from "../../lib/password.js";

export const centersRouter = Router();
centersRouter.use(requireRole("SUPER_ADMIN"));

centersRouter.get("/stats", async (_req, res) => {
  const [centers, activeCenters, users, students, teachers, recentLogins] = await Promise.all([
    prisma.tutoringCenter.count(),
    prisma.tutoringCenter.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.centerMembership.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.centerMembership.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
    prisma.auditLog.count({ where: { action: "auth.login", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
  ]);
  res.json({ centers, activeCenters, users, students, teachers, loginsLast7Days: recentLogins });
});

centersRouter.get("/", async (_req, res) => {
  const centers = await prisma.tutoringCenter.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await prisma.centerMembership.groupBy({
    by: ["centerId", "role"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  res.json(
    centers.map((c) => {
      const mine = counts.filter((r) => r.centerId === c.id);
      const n = (role: string) => mine.find((r) => r.role === role)?._count._all ?? 0;
      return { ...c, counts: { admins: n("CENTER_ADMIN"), teachers: n("TEACHER"), students: n("STUDENT"), parents: n("PARENT") } };
    }),
  );
});

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes")
  .min(3)
  .max(60);

const CenterBody = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(254).optional(),
  defaultGradeScale: z.enum(["SCALE_20", "PERCENT"]).default("SCALE_20"),
});

centersRouter.post("/", async (req, res) => {
  const body = parse(CenterBody, req.body);
  if (await prisma.tutoringCenter.findUnique({ where: { slug: body.slug } })) throw conflict("Slug already in use");
  const center = await prisma.tutoringCenter.create({ data: body });
  await audit({ action: "center.create", actorId: req.auth!.user.id, centerId: center.id, entityType: "TutoringCenter", entityId: center.id, ip: req.ip });
  res.status(201).json(center);
});

centersRouter.patch("/:id", async (req, res) => {
  const body = parse(CenterBody.partial().extend({ status: z.enum(["ACTIVE", "INACTIVE"]).optional() }), req.body);
  const existing = await prisma.tutoringCenter.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound();
  if (body.slug && body.slug !== existing.slug && (await prisma.tutoringCenter.findUnique({ where: { slug: body.slug } })))
    throw conflict("Slug already in use");
  const center = await prisma.tutoringCenter.update({ where: { id: existing.id }, data: body });
  await audit({
    action: body.status && body.status !== existing.status ? `center.${body.status === "ACTIVE" ? "activate" : "deactivate"}` : "center.update",
    actorId: req.auth!.user.id,
    centerId: center.id,
    entityType: "TutoringCenter",
    entityId: center.id,
    metadata: body,
    ip: req.ip,
  });
  res.json(center);
});

centersRouter.get("/:id/admins", async (req, res) => {
  const admins = await prisma.centerMembership.findMany({
    where: { centerId: req.params.id, role: "CENTER_ADMIN" },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true, lastLoginAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(admins.map((m) => ({ ...m.user, membershipId: m.id, userStatus: m.user.status, status: m.status })));
});

const AdminBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password: z.string().min(passwordSchemaRules.min).max(passwordSchemaRules.max),
});

centersRouter.post("/:id/admins", async (req, res) => {
  const body = parse(AdminBody, req.body);
  const center = await prisma.tutoringCenter.findUnique({ where: { id: req.params.id } });
  if (!center) throw notFound();
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict("A user with this email already exists");
  const user = await prisma.user.create({
    data: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      passwordHash: await hashPassword(body.password),
      memberships: { create: { centerId: center.id, role: "CENTER_ADMIN" } },
    },
  });
  await audit({ action: "center.admin_create", actorId: req.auth!.user.id, centerId: center.id, entityType: "User", entityId: user.id, ip: req.ip });
  res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
});

centersRouter.patch("/:id/admins/:membershipId", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }), req.body);
  const m = await prisma.centerMembership.findFirst({ where: { id: req.params.membershipId, centerId: req.params.id, role: "CENTER_ADMIN" } });
  if (!m) throw notFound();
  await prisma.centerMembership.update({ where: { id: m.id }, data: { status } });
  if (status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId: m.userId, activeCenterId: m.centerId } });
  await audit({ action: `center.admin_${status.toLowerCase()}`, actorId: req.auth!.user.id, centerId: m.centerId, entityType: "CenterMembership", entityId: m.id, ip: req.ip });
  res.json({ ok: true });
});

centersRouter.get("/activity", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { firstName: true, lastName: true, email: true } }, center: { select: { name: true } } },
  });
  res.json(logs);
});
