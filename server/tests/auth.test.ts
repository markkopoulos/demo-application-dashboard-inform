import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/prisma.js";
import { buildFixture, getApp, loginAs, ORIGIN, PASSWORD, resetDb, type Fixture } from "./helpers.js";

let fx: Fixture;
beforeAll(async () => {
  await resetDb();
  fx = await buildFixture();
});

describe("login & logout", () => {
  it("logs in with valid credentials and sets an HTTP-only session cookie", async () => {
    const res = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "admin-a@test.example", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("CENTER_ADMIN");
    expect(res.body.center.id).toBe(fx.centerA.id);
    expect(res.body.csrfToken).toEqual(expect.any(String));
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/educore_sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    // Raw token must not be stored: DB holds only a hash.
    const token = /educore_sid=([^;]+)/.exec(cookie)![1]!;
    expect(await prisma.session.findFirst({ where: { tokenHash: token } })).toBeNull();
  });

  it("is case-insensitive on email", async () => {
    const res = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "Admin-A@Test.Example", password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("rejects a wrong password and an unknown email with the same message", async () => {
    const a = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "admin-a@test.example", password: "nope-nope-nope" });
    const b = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "ghost@test.example", password: "nope-nope-nope" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it("validates the login body", async () => {
    const res = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns /me for a session and 401 without one", async () => {
    const s = await loginAs("teacher-a@test.example");
    const me = await s.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("TEACHER");
    expect(me.body.user).not.toHaveProperty("passwordHash");
    expect((await request(getApp()).get("/api/auth/me")).status).toBe(401);
  });

  it("logs out and invalidates the session server-side", async () => {
    const s = await loginAs("student-a@test.example");
    const cookieBefore = await prisma.session.count({ where: { userId: fx.studentAUser.id } });
    expect(cookieBefore).toBeGreaterThan(0);
    expect((await s.post("/api/auth/logout")).status).toBe(204);
    expect((await s.get("/api/auth/me")).status).toBe(401);
    expect(await prisma.session.count({ where: { userId: fx.studentAUser.id } })).toBe(0);
  });

  it("blocks suspended accounts and kills their existing sessions", async () => {
    const s = await loginAs("student-a2@test.example");
    await prisma.user.update({ where: { id: fx.studentA2User.id }, data: { status: "SUSPENDED" } });
    expect((await s.get("/api/auth/me")).status).toBe(401);
    const res = await request(getApp()).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "student-a2@test.example", password: PASSWORD });
    expect(res.status).toBe(403);
    await prisma.user.update({ where: { id: fx.studentA2User.id }, data: { status: "ACTIVE" } });
  });

  it("expires idle sessions", async () => {
    const s = await loginAs("parent-a@test.example");
    await prisma.session.updateMany({ where: { userId: fx.parentAUser.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await s.get("/api/auth/me")).status).toBe(401);
  });

  it("respects the absolute session lifetime even if active", async () => {
    const s = await loginAs("parent-a@test.example");
    await prisma.session.updateMany({ where: { userId: fx.parentAUser.id }, data: { absoluteExpiresAt: new Date(Date.now() - 1000) } });
    expect((await s.get("/api/auth/me")).status).toBe(401);
  });
});

describe("CSRF protection", () => {
  it("rejects authenticated mutations without the CSRF token", async () => {
    const s = await loginAs("admin-a@test.example");
    const res = await s.agent.patch("/api/me/profile").set("Origin", ORIGIN).send({ firstName: "X" });
    expect(res.status).toBe(403);
  });

  it("rejects a wrong CSRF token", async () => {
    const s = await loginAs("admin-a@test.example");
    const res = await s.agent.patch("/api/me/profile").set("Origin", ORIGIN).set("X-CSRF-Token", "forged").send({ firstName: "X" });
    expect(res.status).toBe(403);
  });

  it("rejects cross-origin mutations even with a valid token", async () => {
    const s = await loginAs("admin-a@test.example");
    const res = await s.agent.patch("/api/me/profile").set("Origin", "https://evil.example").set("X-CSRF-Token", s.csrf).send({ firstName: "X" });
    expect(res.status).toBe(403);
  });

  it("accepts a same-origin mutation with the token", async () => {
    const s = await loginAs("admin-a@test.example");
    const res = await s.patch("/api/me/profile", { locale: "en" });
    expect(res.status).toBe(200);
    expect(res.body.user.locale).toBe("en");
  });

  it("rejects cross-origin login attempts", async () => {
    const res = await request(getApp()).post("/api/auth/login").set("Origin", "https://evil.example").send({ email: "admin-a@test.example", password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe("password reset", () => {
  it("resets the password with a valid token, revokes sessions, and rejects reuse", async () => {
    const s = await loginAs("teacher2-a@test.example");
    const forgot = await request(getApp()).post("/api/auth/password/forgot").set("Origin", ORIGIN).send({ email: "teacher2-a@test.example" });
    expect(forgot.status).toBe(202);
    const token = new URL(forgot.body.devResetUrl).searchParams.get("token")!;

    const reset = await request(getApp()).post("/api/auth/password/reset").set("Origin", ORIGIN).send({ token, password: "Brand-New-Pass-1" });
    expect(reset.status).toBe(200);
    expect((await s.get("/api/auth/me")).status).toBe(401); // old session revoked

    const reuse = await request(getApp()).post("/api/auth/password/reset").set("Origin", ORIGIN).send({ token, password: "Another-Pass-22" });
    expect(reuse.status).toBe(400);

    await loginAs("teacher2-a@test.example", "Brand-New-Pass-1");
    // restore for other tests
    await prisma.user.update({ where: { id: fx.teacher2User.id }, data: { passwordHash: (await prisma.user.findUniqueOrThrow({ where: { id: fx.adminA.id } })).passwordHash } });
  });

  it("responds identically for unknown emails", async () => {
    const res = await request(getApp()).post("/api/auth/password/forgot").set("Origin", ORIGIN).send({ email: "ghost@test.example" });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects expired tokens", async () => {
    const forgot = await request(getApp()).post("/api/auth/password/forgot").set("Origin", ORIGIN).send({ email: "parent-a@test.example" });
    const token = new URL(forgot.body.devResetUrl).searchParams.get("token")!;
    await prisma.passwordResetToken.updateMany({ where: { userId: fx.parentAUser.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(getApp()).post("/api/auth/password/reset").set("Origin", ORIGIN).send({ token, password: "Brand-New-Pass-1" });
    expect(res.status).toBe(400);
  });
});
