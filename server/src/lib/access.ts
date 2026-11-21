/**
 * Resource-ownership checks. Every center-scoped handler composes these with
 * the caller's role. Functions return booleans; handlers translate a `false`
 * into notFound() so we don't reveal records outside the caller's scope.
 */
import { prisma } from "./prisma.js";
import type { CenterAuthContext } from "../middleware/auth.js";

const STAFF_ADMIN = new Set(["CENTER_ADMIN", "SUPER_ADMIN"]);

export const isCenterAdmin = (ctx: CenterAuthContext) => STAFF_ADMIN.has(ctx.role ?? "");

export async function teacherProfileId(ctx: CenterAuthContext): Promise<string | null> {
  const t = await prisma.teacherProfile.findUnique({
    where: { centerId_userId: { centerId: ctx.centerId, userId: ctx.user.id } },
    select: { id: true, archivedAt: true },
  });
  return t && !t.archivedAt ? t.id : null;
}

export async function studentProfileId(ctx: CenterAuthContext): Promise<string | null> {
  const s = await prisma.studentProfile.findUnique({
    where: { centerId_userId: { centerId: ctx.centerId, userId: ctx.user.id } },
    select: { id: true, archivedAt: true },
  });
  return s && !s.archivedAt ? s.id : null;
}

/** Class IDs a teacher is assigned to within the active center. */
export async function teacherClassIds(ctx: CenterAuthContext): Promise<string[]> {
  const tid = await teacherProfileId(ctx);
  if (!tid) return [];
  const rows = await prisma.classTeacherAssignment.findMany({
    where: { teacherId: tid, centerId: ctx.centerId },
    select: { classGroupId: true },
  });
  return rows.map((r) => r.classGroupId);
}

/** StudentProfile IDs linked to the calling parent within the active center. */
export async function parentStudentIds(ctx: CenterAuthContext): Promise<string[]> {
  const rows = await prisma.parentStudentLink.findMany({
    where: { parentUserId: ctx.user.id, centerId: ctx.centerId, student: { archivedAt: null } },
    select: { studentId: true },
  });
  return rows.map((r) => r.studentId);
}

/** Can the caller see this class (and its materials, schedule, announcements)? */
export async function canAccessClass(ctx: CenterAuthContext, classGroupId: string): Promise<boolean> {
  const cls = await prisma.classGroup.findFirst({ where: { id: classGroupId, centerId: ctx.centerId }, select: { id: true } });
  if (!cls) return false; // other center or nonexistent
  switch (ctx.role) {
    case "SUPER_ADMIN":
    case "CENTER_ADMIN":
      return true;
    case "TEACHER":
      return (await teacherClassIds(ctx)).includes(classGroupId);
    case "STUDENT": {
      const sid = await studentProfileId(ctx);
      if (!sid) return false;
      return !!(await prisma.enrollment.findFirst({ where: { classGroupId, studentId: sid, status: "ACTIVE" }, select: { id: true } }));
    }
    case "PARENT": {
      const kids = await parentStudentIds(ctx);
      if (!kids.length) return false;
      return !!(await prisma.enrollment.findFirst({
        where: { classGroupId, studentId: { in: kids }, status: "ACTIVE" },
        select: { id: true },
      }));
    }
    default:
      return false;
  }
}

/** Can the caller see this student's private records (grades, attendance, submissions)? */
export async function canAccessStudent(ctx: CenterAuthContext, studentId: string): Promise<boolean> {
  const student = await prisma.studentProfile.findFirst({ where: { id: studentId, centerId: ctx.centerId }, select: { id: true } });
  if (!student) return false;
  switch (ctx.role) {
    case "SUPER_ADMIN":
    case "CENTER_ADMIN":
      return true;
    case "TEACHER": {
      const classIds = await teacherClassIds(ctx);
      if (!classIds.length) return false;
      return !!(await prisma.enrollment.findFirst({
        where: { studentId, classGroupId: { in: classIds }, status: "ACTIVE" },
        select: { id: true },
      }));
    }
    case "STUDENT":
      return (await studentProfileId(ctx)) === studentId;
    case "PARENT":
      return (await parentStudentIds(ctx)).includes(studentId);
    default:
      return false;
  }
}
