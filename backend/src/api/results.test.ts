import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authSessions } = vi.hoisted(() => ({
  authSessions: new Map<string, { teacherId: string; expiresAt: Date }>(),
}));

const TEACHER_WILDCARD = { id: "teacher-1", username: "controller", name: "Nasrin Akter", role: "Exam controller", scope: "*" };
const TEACHER_SCOPED = { id: "teacher-2", username: "teacher9a", name: "Abdul Karim", role: "Class teacher", scope: "class-9" };

const SESSION = { id: "sess-1", caseId: "PUB-01", name: "Test Session" };
const SUBJECTS = [
  { id: "subj-ban", sessionId: "sess-1", code: "BAN", name: "Bangla", hasPractical: false, isCompulsory: true, displayOrder: 0 },
  { id: "subj-rel", sessionId: "sess-1", code: "REL", name: "Religion", hasPractical: false, isCompulsory: false, displayOrder: 1 },
];

function studentRow(id: string, rollNo: string, className: string, banMark: number | "AB") {
  const absent = banMark === "AB";
  return {
    id, rollNo, name: `Student ${rollNo}`, className,
    optionalSubject: { code: "REL" },
    marks: [
      { isAbsent: absent, wholeScore: absent ? null : (banMark as number), theoryScore: null, practicalScore: null, subject: { code: "BAN" } },
      { isAbsent: false, wholeScore: 70, theoryScore: null, practicalScore: null, subject: { code: "REL" } },
    ],
  };
}

const CLASS9_STUDENT = studentRow("row-1", "S001", "Class 9", 70);
const CLASS10_STUDENT = studentRow("row-2", "S002", "Class 10", "AB");

vi.mock("../db/prisma.js", () => ({
  prisma: {
    examSession: {
      findUnique: vi.fn(() => Promise.resolve({ ...SESSION, subjects: SUBJECTS })),
    },
    student: {
      findMany: vi.fn(() => Promise.resolve([CLASS9_STUDENT, CLASS10_STUDENT])),
    },
    authSession: {
      findUnique: vi.fn(({ where }: { where: { tokenHash: string } }) => {
        const session = authSessions.get(where.tokenHash);
        if (!session) return Promise.resolve(null);
        const teacher = session.teacherId === TEACHER_WILDCARD.id ? TEACHER_WILDCARD : TEACHER_SCOPED;
        return Promise.resolve({ ...session, teacher });
      }),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { createApp } = await import("../app.js");
const { createHash } = await import("node:crypto");

function seedRawSession(teacherId: string): string {
  const token = `test-token-${teacherId}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  authSessions.set(tokenHash, { teacherId, expiresAt: new Date(Date.now() + 10_000) });
  return token;
}

beforeEach(() => {
  authSessions.clear();
});

describe("GET /api/v1/results", () => {
  it("401s with no session", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/results");
    expect(res.status).toBe(401);
  });

  it("returns every class for scope '*'", async () => {
    const token = seedRawSession(TEACHER_WILDCARD.id);
    const app = createApp();
    const res = await request(app).get("/api/v1/results").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(2);
    expect(res.body.classes.map((c: { id: string }) => c.id).sort()).toEqual(["class-10", "class-9"]);
  });

  it("filters to only the teacher's own class for a scoped account", async () => {
    const token = seedRawSession(TEACHER_SCOPED.id);
    const app = createApp();
    const res = await request(app).get("/api/v1/results").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].id).toBe("row-1");
    expect(res.body.classes).toEqual([{ id: "class-9", name: "Class 9", session: res.body.meta.session }]);
  });
});

describe("GET /api/v1/results/computed (bonus)", () => {
  it("401s with no session", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/results/computed");
    expect(res.status).toBe(401);
  });

  it("returns computed grading results, respecting scope", async () => {
    const token = seedRawSession(TEACHER_SCOPED.id);
    const app = createApp();
    const res = await request(app).get("/api/v1/results/computed").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rollNo).toBe("S001");
    expect(typeof res.body[0].officialGpa).toBe("number");
  });
});

describe("GET /api/v1/checklists (bonus)", () => {
  it("puts the absent student on the absent list, scoped correctly", async () => {
    const token = seedRawSession(TEACHER_WILDCARD.id);
    const app = createApp();
    const res = await request(app).get("/api/v1/checklists").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.absent).toContain("S002");
    expect(res.body.absent).not.toContain("S001");
  });
});
