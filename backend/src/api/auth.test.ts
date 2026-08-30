import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A real in-memory store behind the mocked Prisma calls, so a login's
// created session can actually be found by a later /session or /logout call
// in the same test - this exercises the real lifecycle, not per-call stubs.
const { teacherAccounts, authSessions } = vi.hoisted(() => ({
  teacherAccounts: new Map<string, { id: string; username: string; passwordHash: string; name: string; role: string; scope: string }>(),
  authSessions: new Map<string, { tokenHash: string; teacherId: string; expiresAt: Date }>(),
}));

vi.mock("../db/prisma.js", () => ({
  prisma: {
    teacherAccount: {
      findUnique: vi.fn(({ where }: { where: { username: string } }) =>
        Promise.resolve(teacherAccounts.get(where.username) ?? null),
      ),
    },
    authSession: {
      create: vi.fn(({ data }: { data: { tokenHash: string; teacherId: string; expiresAt: Date } }) => {
        authSessions.set(data.tokenHash, data);
        return Promise.resolve(data);
      }),
      findUnique: vi.fn(({ where }: { where: { tokenHash: string } }) => {
        const session = authSessions.get(where.tokenHash);
        if (!session) return Promise.resolve(null);
        const teacher = [...teacherAccounts.values()].find((t) => t.id === session.teacherId);
        return Promise.resolve({ ...session, teacher });
      }),
      delete: vi.fn(({ where }: { where: { tokenHash: string } }) => {
        authSessions.delete(where.tokenHash);
        return Promise.resolve({});
      }),
    },
  },
}));

const { createApp } = await import("../app.js");

beforeEach(async () => {
  teacherAccounts.clear();
  authSessions.clear();
  teacherAccounts.set("controller", {
    id: "teacher-1",
    username: "controller",
    passwordHash: await bcrypt.hash("result2026", 10),
    name: "Nasrin Akter",
    role: "Exam controller",
    scope: "*",
  });
});

describe("POST /api/v1/auth/login", () => {
  it("401s with the wrong password", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "controller", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("401s with an unknown username (same error as a wrong password)", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "nobody", password: "anything" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("422s a malformed body", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/auth/login").send({ username: "controller" });
    expect(res.status).toBe(422);
  });

  it("200s with correct credentials, returns the Teacher shape, and sets an httpOnly cookie", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "controller", password: "result2026" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      username: "controller", name: "Nasrin Akter", role: "Exam controller", scope: "*",
    });

    const cookie = res.headers["set-cookie"]?.[0] as string;
    expect(cookie).toMatch(/^sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe("GET /api/v1/auth/session", () => {
  it("401s with no cookie", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/auth/session");
    expect(res.status).toBe(401);
  });

  it("401s with a garbage cookie", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/auth/session").set("Cookie", "sid=not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("200s and restores the Teacher after a real login, via the same agent", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent.post("/api/v1/auth/login").send({ username: "controller", password: "result2026" });
    const res = await agent.get("/api/v1/auth/session");

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("controller");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("204s and invalidates the session so a later /session call 401s", async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent.post("/api/v1/auth/login").send({ username: "controller", password: "result2026" });
    const logoutRes = await agent.post("/api/v1/auth/logout");
    expect(logoutRes.status).toBe(204);

    const sessionRes = await agent.get("/api/v1/auth/session");
    expect(sessionRes.status).toBe(401);
  });

  it("204s even with no active session (idempotent)", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(204);
  });
});
