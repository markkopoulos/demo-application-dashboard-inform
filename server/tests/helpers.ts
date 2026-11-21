import request from "supertest";
import type { Express } from "express";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";
import { createApp } from "../src/app.js";

export const PASSWORD = "Test-Password-123";
export const ORIGIN = "http://localhost:5173";

let app: Express | null = null;
export const getApp = () => (app ??= createApp());

export async function resetDb() {
  // Safety net: never wipe anything that isn't a test database.
  if (!/test/i.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error("resetDb() refused: DATABASE_URL is not a test database");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  // MySQL enforces RESTRICT (ClassGroup → Subject/AcademicYear) mid-cascade,
  // so remove classes (which cascade exams, lessons, …) before their centers.
  await prisma.classGroup.deleteMany();
  await prisma.tutoringCenter.deleteMany();
  await prisma.user.deleteMany();
}

let hash: string | null = null;
async function pw() {
  return (hash ??= await hashPassword(PASSWORD));
}

let seq = 0;
async function user(email: string, extra: Record<string, unknown> = {}) {
  return prisma.user.create({ data: { email, firstName: "Test", lastName: `User${++seq}`, passwordHash: await pw(), ...extra } });
}

/**
 * Two centers (A and B). Center A has: admin, teacher (assigned to classA1),
 * teacher2 (no classes), studentA (in classA1), studentA2 (in classA2 only),
 * parentA (linked to studentA). Center B has an admin and studentB.
 */
export async function buildFixture() {
  const superAdmin = await user("super@test.example", { platformRole: "SUPER_ADMIN" });
  const centerA = await prisma.tutoringCenter.create({ data: { name: "Center A", slug: "center-a" } });
  const centerB = await prisma.tutoringCenter.create({ data: { name: "Center B", slug: "center-b" } });
  const yearA = await prisma.academicYear.create({
    data: { centerId: centerA.id, label: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true },
  });
  const yearB = await prisma.academicYear.create({
    data: { centerId: centerB.id, label: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true },
  });
  const mathA = await prisma.subject.create({ data: { centerId: centerA.id, name: "Μαθηματικά" } });
  const mathB = await prisma.subject.create({ data: { centerId: centerB.id, name: "Μαθηματικά" } });

  const member = async (email: string, centerId: string, role: "CENTER_ADMIN" | "TEACHER" | "STUDENT" | "PARENT") => {
    const u = await user(email);
    await prisma.centerMembership.create({ data: { userId: u.id, centerId, role } });
    return u;
  };

  const adminA = await member("admin-a@test.example", centerA.id, "CENTER_ADMIN");
  const adminB = await member("admin-b@test.example", centerB.id, "CENTER_ADMIN");
  const teacherUser = await member("teacher-a@test.example", centerA.id, "TEACHER");
  const teacher2User = await member("teacher2-a@test.example", centerA.id, "TEACHER");
  const studentAUser = await member("student-a@test.example", centerA.id, "STUDENT");
  const studentA2User = await member("student-a2@test.example", centerA.id, "STUDENT");
  const studentBUser = await member("student-b@test.example", centerB.id, "STUDENT");
  const parentAUser = await member("parent-a@test.example", centerA.id, "PARENT");

  const teacher = await prisma.teacherProfile.create({ data: { centerId: centerA.id, userId: teacherUser.id } });
  const teacher2 = await prisma.teacherProfile.create({ data: { centerId: centerA.id, userId: teacher2User.id } });
  const studentA = await prisma.studentProfile.create({ data: { centerId: centerA.id, userId: studentAUser.id, studentCode: "A-1" } });
  const studentA2 = await prisma.studentProfile.create({ data: { centerId: centerA.id, userId: studentA2User.id, studentCode: "A-2" } });
  const studentB = await prisma.studentProfile.create({ data: { centerId: centerB.id, userId: studentBUser.id, studentCode: "B-1" } });

  const classA1 = await prisma.classGroup.create({
    data: { centerId: centerA.id, academicYearId: yearA.id, subjectId: mathA.id, name: "A1", level: "LYK_C" },
  });
  const classA2 = await prisma.classGroup.create({
    data: { centerId: centerA.id, academicYearId: yearA.id, subjectId: mathA.id, name: "A2", level: "LYK_B" },
  });
  const classB1 = await prisma.classGroup.create({
    data: { centerId: centerB.id, academicYearId: yearB.id, subjectId: mathB.id, name: "B1", level: "LYK_C" },
  });
  await prisma.classTeacherAssignment.create({ data: { centerId: centerA.id, classGroupId: classA1.id, teacherId: teacher.id } });
  await prisma.enrollment.create({ data: { centerId: centerA.id, classGroupId: classA1.id, studentId: studentA.id } });
  await prisma.enrollment.create({ data: { centerId: centerA.id, classGroupId: classA2.id, studentId: studentA2.id } });
  await prisma.enrollment.create({ data: { centerId: centerB.id, classGroupId: classB1.id, studentId: studentB.id } });
  await prisma.parentStudentLink.create({ data: { centerId: centerA.id, parentUserId: parentAUser.id, studentId: studentA.id } });

  return {
    superAdmin, centerA, centerB, adminA, adminB, teacherUser, teacher2User, teacher, teacher2,
    studentAUser, studentA2User, studentBUser, parentAUser, studentA, studentA2, studentB, classA1, classA2, classB1,
  };
}
export type Fixture = Awaited<ReturnType<typeof buildFixture>>;

/** A logged-in supertest agent that automatically sends Origin + CSRF headers. */
export async function loginAs(email: string, password = PASSWORD) {
  const agent = request.agent(getApp());
  const res = await agent.post("/api/auth/login").set("Origin", ORIGIN).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf: string = res.body.csrfToken;
  return {
    agent,
    me: res.body,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set("Origin", ORIGIN).set("X-CSRF-Token", csrf).send(body ?? {}),
    patch: (url: string, body?: object) => agent.patch(url).set("Origin", ORIGIN).set("X-CSRF-Token", csrf).send(body ?? {}),
  };
}
