import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authSessions } = vi.hoisted(() => ({
  authSessions: new Map<string, { teacherId: string; expiresAt: Date }>(),
}));

const TEACHER = { id: "teacher-1", username: "controller", name: "Nasrin Akter", role: "Exam controller", scope: "*" };
const SESSION = { id: "sess-1", caseId: "PUB-01", name: "Test Session" };
const SUBJECTS = [
  { id: "subj-ban", sessionId: "sess-1", code: "BAN", name: "Bangla", hasPractical: false, isCompulsory: true, displayOrder: 0 },
  { id: "subj-phy", sessionId: "sess-1", code: "PHY", name: "Physics", hasPractical: true, isCompulsory: true, displayOrder: 1 },
  { id: "subj-rel", sessionId: "sess-1", code: "REL", name: "Religion", hasPractical: false, isCompulsory: false, displayOrder: 2 },
];

const prismaMock = {
  examSession: { findUnique: vi.fn(() => Promise.resolve({ ...SESSION, subjects: SUBJECTS })) },
  student: {
    findMany: vi.fn((): Promise<Array<{ id: string; rollNo: string }>> => Promise.resolve([])),
    findFirst: vi.fn((): Promise<{ id: string } | null> => Promise.resolve(null)),
    create: vi.fn(),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    update: vi.fn(),
  },
  studentMark: { deleteMany: vi.fn(), upsert: vi.fn(), createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
  authSession: {
    findUnique: vi.fn(({ where }: { where: { tokenHash: string } }) => {
      const session = authSessions.get(where.tokenHash);
      return Promise.resolve(session ? { ...session, teacher: TEACHER } : null);
    }),
    create: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

vi.mock("../db/prisma.js", () => ({ prisma: prismaMock }));

const { createApp } = await import("../app.js");
const { createHash } = await import("node:crypto");

function seedRawSession(): string {
  const token = "test-token";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  authSessions.set(tokenHash, { teacherId: TEACHER.id, expiresAt: new Date(Date.now() + 10_000) });
  return token;
}

let TOKEN: string;
beforeEach(() => {
  vi.clearAllMocks();
  authSessions.clear();
  TOKEN = seedRawSession();
  prismaMock.examSession.findUnique.mockResolvedValue({ ...SESSION, subjects: SUBJECTS });
  prismaMock.student.findMany.mockResolvedValue([]);
});

const validBody = {
  name: "Test Student",
  className: "Class 9",
  optionalCode: "REL",
  marks: [
    { code: "BAN", theory: 70 },
    { code: "PHY", theory: 60, practical: 20 },
    { code: "REL", theory: 55 },
  ],
};

describe("POST /api/v1/students", () => {
  it("401s with no session", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/students").send(validBody);
    expect(res.status).toBe(401);
  });

  it("creates a student with the next auto-assigned roll number", async () => {
    prismaMock.student.findMany.mockResolvedValue([{ id: "s1", rollNo: "S001" }, { id: "s5", rollNo: "S005" }]);
    prismaMock.student.create.mockResolvedValue({
      id: "new-1", rollNo: "S006", name: "Test Student", className: "Class 9",
      optionalSubject: { code: "REL" },
    });

    const app = createApp();
    const res = await request(app).post("/api/v1/students").set("Cookie", `sid=${TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.roll).toBe(6);
    expect(prismaMock.student.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rollNo: "S006" }) }),
    );
  });

  it("422s a theory mark out of range", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/students")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ ...validBody, marks: [{ code: "BAN", theory: 70 }, { code: "PHY", theory: 90, practical: 20 }, { code: "REL", theory: 55 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_MARK");
  });

  it("422s an optional subject that is actually compulsory", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/students")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ ...validBody, optionalCode: "BAN" });

    expect(res.status).toBe(422);
  });

  it("422s a missing compulsory mark", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/students")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ ...validBody, marks: [{ code: "BAN", theory: 70 }, { code: "REL", theory: 55 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/PHY/);
  });

  it("accepts an absent mark without requiring theory/practical", async () => {
    prismaMock.student.create.mockResolvedValue({
      id: "new-1", rollNo: "S001", name: "Test", className: "Class 9", optionalSubject: { code: "REL" },
    });
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/students")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ ...validBody, marks: [{ code: "BAN", absent: true }, { code: "PHY", theory: 60, practical: 20 }, { code: "REL", theory: 55 }] });

    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/v1/students/:id/marks/:subjectCode", () => {
  it("404s an unknown student", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    const app = createApp();
    const res = await request(app)
      .patch("/api/v1/students/nope/marks/BAN")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ theory: 70 });
    expect(res.status).toBe(404);
  });

  it("upserts a whole-mark subject", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" });
    prismaMock.studentMark.upsert.mockResolvedValue({});
    const app = createApp();
    const res = await request(app)
      .patch("/api/v1/students/stu-1/marks/BAN")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ theory: 70 });

    expect(res.status).toBe(200);
    expect(res.body.wholeScore).toBe(70);
    expect(prismaMock.studentMark.upsert).toHaveBeenCalled();
  });

  it("marks a subject absent", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" });
    const app = createApp();
    const res = await request(app)
      .patch("/api/v1/students/stu-1/marks/PHY")
      .set("Cookie", `sid=${TOKEN}`)
      .send({ absent: true });

    expect(res.status).toBe(200);
    expect(res.body.isAbsent).toBe(true);
  });
});

describe("GET /api/v1/export/results.csv", () => {
  it("401s with no session", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/export/results.csv");
    expect(res.status).toBe(401);
  });

  it("returns CSV content with the correct headers", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/export/results.csv").set("Cookie", `sid=${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.text).toMatch(/^roll,name,class,optional/);
  });
});

describe("POST /api/v1/import", () => {
  const csv = [
    "roll,name,class,optional,BAN,PHY_theory,PHY_practical,REL",
    "S001,Test One,Class 9,REL,70,60,20,55",
    "S002,Test Two,Class 9,REL,70,90,20,55", // invalid theory (90 > 75)
  ].join("\n");

  it("401s with no session", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/import").set("Content-Type", "text/csv").send(csv);
    expect(res.status).toBe(401);
  });

  it("imports valid rows and reports rejected rows separately", async () => {
    // First findMany call: existing students in session (none). Second:
    // re-fetch of the newly createMany'd rows, to resolve their ids for marks.
    prismaMock.student.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "new-1", rollNo: "S001" }]);
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/import")
      .set("Cookie", `sid=${TOKEN}`)
      .set("Content-Type", "text/csv")
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.rejected).toHaveLength(1);
    expect(res.body.rejected[0].row).toBe(3);
  });

  it("422s a non-CSV body", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/import")
      .set("Cookie", `sid=${TOKEN}`)
      .set("Content-Type", "application/json")
      .send({ not: "csv" });
    expect(res.status).toBe(422);
  });
});
