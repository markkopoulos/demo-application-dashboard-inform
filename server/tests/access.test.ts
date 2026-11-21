import { beforeAll, describe, expect, it } from "vitest";
import { buildFixture, loginAs, resetDb, type Fixture } from "./helpers.js";
import { canAccessClass, canAccessStudent } from "../src/lib/access.js";
import type { CenterAuthContext } from "../src/middleware/auth.js";
import { prisma } from "../src/lib/prisma.js";

let fx: Fixture;
beforeAll(async () => {
  await resetDb();
  fx = await buildFixture();
});

const ctx = (userId: string, centerId: string, role: CenterAuthContext["role"]): CenterAuthContext => ({
  sessionId: "s",
  csrfToken: "c",
  user: { id: userId, email: "", firstName: "", lastName: "", locale: "el", isSuperAdmin: role === "SUPER_ADMIN" },
  role,
  centerId,
});

describe("role-based route access", () => {
  it("only SUPER_ADMIN can reach platform administration", async () => {
    for (const email of ["admin-a@test.example", "teacher-a@test.example", "student-a@test.example", "parent-a@test.example"]) {
      const s = await loginAs(email);
      expect((await s.get("/api/platform/centers")).status, email).toBe(403);
    }
    const sa = await loginAs("super@test.example");
    const res = await sa.get("/api/platform/centers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("ignores client-supplied role hints", async () => {
    const s = await loginAs("student-a@test.example");
    const res = await s.agent.get("/api/platform/centers").set("X-Role", "SUPER_ADMIN").query({ role: "SUPER_ADMIN" });
    expect(res.status).toBe(403);
  });

  it("super admin can create and deactivate a center; deactivation locks out its members", async () => {
    const sa = await loginAs("super@test.example");
    const created = await sa.post("/api/platform/centers", { name: "Center C", slug: "center-c" });
    expect(created.status).toBe(201);

    const studentB = await loginAs("student-b@test.example");
    expect((await studentB.get("/api/auth/me")).body.center.id).toBe(fx.centerB.id);
    expect((await sa.patch(`/api/platform/centers/${fx.centerB.id}`, { status: "INACTIVE" })).status).toBe(200);
    const me = await studentB.get("/api/auth/me");
    expect(me.body.role).toBeNull();
    expect(me.body.center).toBeNull();
    await sa.patch(`/api/platform/centers/${fx.centerB.id}`, { status: "ACTIVE" });
  });

  it("a user cannot switch into a center they are not a member of", async () => {
    const s = await loginAs("admin-a@test.example");
    expect((await s.post("/api/auth/switch-center", { centerId: fx.centerB.id })).status).toBe(404);
  });
});

describe("ownership checks (lib/access)", () => {
  it("students can access only themselves", async () => {
    const c = ctx(fx.studentAUser.id, fx.centerA.id, "STUDENT");
    expect(await canAccessStudent(c, fx.studentA.id)).toBe(true);
    expect(await canAccessStudent(c, fx.studentA2.id)).toBe(false);
    expect(await canAccessStudent(c, fx.studentB.id)).toBe(false);
  });

  it("students can access only classes they're enrolled in", async () => {
    const c = ctx(fx.studentAUser.id, fx.centerA.id, "STUDENT");
    expect(await canAccessClass(c, fx.classA1.id)).toBe(true);
    expect(await canAccessClass(c, fx.classA2.id)).toBe(false);
  });

  it("parents can access only explicitly linked children", async () => {
    const c = ctx(fx.parentAUser.id, fx.centerA.id, "PARENT");
    expect(await canAccessStudent(c, fx.studentA.id)).toBe(true);
    expect(await canAccessStudent(c, fx.studentA2.id)).toBe(false);
    expect(await canAccessClass(c, fx.classA1.id)).toBe(true);
    expect(await canAccessClass(c, fx.classA2.id)).toBe(false);
  });

  it("parent access disappears when the link is removed", async () => {
    const link = await prisma.parentStudentLink.findFirstOrThrow({ where: { parentUserId: fx.parentAUser.id } });
    await prisma.parentStudentLink.delete({ where: { id: link.id } });
    const c = ctx(fx.parentAUser.id, fx.centerA.id, "PARENT");
    expect(await canAccessStudent(c, fx.studentA.id)).toBe(false);
    await prisma.parentStudentLink.create({ data: { centerId: link.centerId, parentUserId: link.parentUserId, studentId: link.studentId } });
  });

  it("teachers can access only students in their assigned classes", async () => {
    const t1 = ctx(fx.teacherUser.id, fx.centerA.id, "TEACHER");
    expect(await canAccessStudent(t1, fx.studentA.id)).toBe(true);
    expect(await canAccessStudent(t1, fx.studentA2.id)).toBe(false);
    expect(await canAccessClass(t1, fx.classA2.id)).toBe(false);
    const t2 = ctx(fx.teacher2User.id, fx.centerA.id, "TEACHER");
    expect(await canAccessStudent(t2, fx.studentA.id)).toBe(false);
  });

  it("center admins are isolated to their own center", async () => {
    const a = ctx(fx.adminA.id, fx.centerA.id, "CENTER_ADMIN");
    expect(await canAccessStudent(a, fx.studentA2.id)).toBe(true);
    expect(await canAccessStudent(a, fx.studentB.id)).toBe(false);
    expect(await canAccessClass(a, fx.classB1.id)).toBe(false);
  });

  it("a forged context pairing a user with another center finds nothing", async () => {
    // Even if a bug passed the wrong centerId, records are filtered by centerId.
    const c = ctx(fx.studentAUser.id, fx.centerB.id, "STUDENT");
    expect(await canAccessStudent(c, fx.studentA.id)).toBe(false);
    expect(await canAccessClass(c, fx.classA1.id)).toBe(false);
  });
});
