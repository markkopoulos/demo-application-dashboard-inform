import { describe, expect, it } from "vitest";
import request from "supertest";
import { getApp } from "./helpers.js";

describe("health & errors", () => {
  it("reports healthy with a reachable database", async () => {
    const res = await request(getApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "ok" });
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(getApp()).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a safe 400 for malformed JSON", async () => {
    const res = await request(getApp()).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/); // no stack traces
  });
});
