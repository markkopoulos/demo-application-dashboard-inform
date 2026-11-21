import { beforeAll, describe, expect, it } from "vitest";
import { buildFixture, loginAs, resetDb } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  await buildFixture();
});

describe("GET /api/overview", () => {
  it("admin sees only their own center's counts", async () => {
    const s = await loginAs("admin-a@test.example");
    const res = await s.get("/api/overview");
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("admin");
    expect(res.body.counts).toMatchObject({ students: 2, teachers: 2, classes: 2 });
    expect(res.body.classes.map((c: { name: string }) => c.name)).not.toContain("B1");
  });

  it("teacher sees only assigned classes", async () => {
    const s = await loginAs("teacher-a@test.example");
    const res = await s.get("/api/overview");
    expect(res.body.classes.map((c: { name: string }) => c.name)).toEqual(["A1"]);
    expect(res.body.counts.students).toBe(1);
  });

  it("student sees only enrolled classes", async () => {
    const s = await loginAs("student-a2@test.example");
    const res = await s.get("/api/overview");
    expect(res.body.classes.map((c: { name: string }) => c.name)).toEqual(["A2"]);
  });

  it("parent sees only linked children", async () => {
    const s = await loginAs("parent-a@test.example");
    const res = await s.get("/api/overview");
    expect(res.body.children).toHaveLength(1);
    expect(res.body.children[0].studentCode).toBe("A-1");
  });

  it("super admin without an active center is refused", async () => {
    const s = await loginAs("super@test.example");
    expect((await s.get("/api/overview")).status).toBe(403);
  });
});
