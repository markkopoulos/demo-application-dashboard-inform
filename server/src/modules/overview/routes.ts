/**
 * Role-aware home-page summary used by the application shell. Every number is a
 * live database query scoped to the caller's center and ownership.
 */
import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { centerCtx, requireCenter, requireRole } from "../../middleware/auth.js";
import { parentStudentIds, studentProfileId, teacherProfileId } from "../../lib/access.js";

export const overviewRouter = Router();
overviewRouter.use(requireCenter, requireRole("SUPER_ADMIN", "CENTER_ADMIN", "TEACHER", "STUDENT", "PARENT"));

const classSelect = {
  id: true,
  name: true,
  level: true,
  room: true,
  color: true,
  subject: { select: { id: true, name: true, color: true } },
  scheduleSlots: { select: { dayOfWeek: true, startTime: true, endTime: true, room: true }, orderBy: [{ dayOfWeek: "asc" as const }, { startTime: "asc" as const }] },
  teachers: { select: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } } } },
  _count: { select: { enrollments: { where: { status: "ACTIVE" as const } } } },
};

type ClassRow = Awaited<ReturnType<typeof loadClasses>>[number];
const loadClasses = (where: object) =>
  prisma.classGroup.findMany({ where: { archivedAt: null, ...where }, select: classSelect, orderBy: { name: "asc" } });

const shapeClass = (c: ClassRow) => ({
  id: c.id,
  name: c.name,
  level: c.level,
  room: c.room,
  color: c.color ?? c.subject.color,
  subject: c.subject,
  schedule: c.scheduleSlots,
  teachers: c.teachers.map((t) => `${t.teacher.user.firstName} ${t.teacher.user.lastName}`),
  studentCount: c._count.enrollments,
});

overviewRouter.get("/", async (req, res) => {
  const ctx = centerCtx(req);
  const centerId = ctx.centerId;

  if (ctx.role === "CENTER_ADMIN" || ctx.role === "SUPER_ADMIN") {
    const [students, teachers, parents, classes, subjects, year] = await Promise.all([
      prisma.studentProfile.count({ where: { centerId, archivedAt: null } }),
      prisma.teacherProfile.count({ where: { centerId, archivedAt: null } }),
      prisma.centerMembership.count({ where: { centerId, role: "PARENT", status: "ACTIVE" } }),
      loadClasses({ centerId, academicYear: { isCurrent: true } }),
      prisma.subject.count({ where: { centerId } }),
      prisma.academicYear.findFirst({ where: { centerId, isCurrent: true }, select: { label: true } }),
    ]);
    return res.json({
      kind: "admin",
      academicYear: year?.label ?? null,
      counts: { students, teachers, parents, classes: classes.length, subjects },
      classes: classes.map(shapeClass),
    });
  }

  if (ctx.role === "TEACHER") {
    const tid = await teacherProfileId(ctx);
    const classes = tid ? await loadClasses({ centerId, teachers: { some: { teacherId: tid } } }) : [];
    const studentIds = new Set(
      (
        await prisma.enrollment.findMany({
          where: { centerId, status: "ACTIVE", classGroupId: { in: classes.map((c) => c.id) } },
          select: { studentId: true },
        })
      ).map((e) => e.studentId),
    );
    return res.json({ kind: "teacher", counts: { classes: classes.length, students: studentIds.size }, classes: classes.map(shapeClass) });
  }

  if (ctx.role === "STUDENT") {
    const sid = await studentProfileId(ctx);
    const classes = sid ? await loadClasses({ centerId, enrollments: { some: { studentId: sid, status: "ACTIVE" } } }) : [];
    return res.json({ kind: "student", classes: classes.map(shapeClass) });
  }

  // PARENT
  const kids = await parentStudentIds(ctx);
  const children = await prisma.studentProfile.findMany({
    where: { id: { in: kids }, centerId },
    select: { id: true, studentCode: true, level: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: "asc" } },
  });
  const perChild = await Promise.all(
    children.map(async (c) => ({
      id: c.id,
      firstName: c.user.firstName,
      lastName: c.user.lastName,
      studentCode: c.studentCode,
      level: c.level,
      classes: (await loadClasses({ centerId, enrollments: { some: { studentId: c.id, status: "ACTIVE" } } })).map(shapeClass),
    })),
  );
  res.json({ kind: "parent", children: perChild });
});
