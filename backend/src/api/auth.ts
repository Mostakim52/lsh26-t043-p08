import { Router } from "express";
import { z } from "zod";

import { verifyPassword } from "../auth/passwords.js";
import { clearSessionCookie, setSessionCookie } from "../auth/cookies.js";
import { requireAuth } from "../auth/middleware.js";
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "../auth/session.js";
import { prisma } from "../db/prisma.js";
import { ApiError } from "./errors.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

interface TeacherView {
  username: string;
  name: string;
  role: string;
  scope: string;
}

function toTeacherView(teacher: { username: string; name: string; role: string; scope: string }): TeacherView {
  return { username: teacher.username, name: teacher.name, role: teacher.role, scope: teacher.scope };
}

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(422, "INVALID_BODY", "username and password are required");
  }

  const teacher = await prisma.teacherAccount.findUnique({
    where: { username: parsed.data.username },
  });
  const passwordOk = teacher ? await verifyPassword(parsed.data.password, teacher.passwordHash) : false;

  if (!teacher || !passwordOk) {
    // Same message whether the username or the password was wrong - never
    // reveal which one, since that lets an attacker enumerate usernames.
    throw new ApiError(401, "INVALID_CREDENTIALS", "Those details were not recognised.");
  }

  const { token, expiresAt } = await createSession(teacher.id);
  setSessionCookie(res, token, expiresAt);
  res.json(toTeacherView(teacher));
});

router.get("/auth/session", requireAuth, (req, res) => {
  res.json(toTeacherView(req.teacher!));
});

router.post("/auth/logout", async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === "string" && token.length > 0) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

export default router;
