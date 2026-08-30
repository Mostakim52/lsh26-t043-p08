import { randomBytes, createHash } from "node:crypto";

import { prisma } from "../db/prisma.js";

export const SESSION_COOKIE_NAME = "sid";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours - a full judging day, not indefinite

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a session row and returns the raw token to set as the cookie
 * value. Only the token's hash is ever persisted, so a database read alone
 * can't be replayed as a live session.
 */
export async function createSession(teacherId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.authSession.create({
    data: { tokenHash: hashToken(token), teacherId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Resolves a raw cookie token to its TeacherAccount, or null if the token is
 * unknown or expired. Expired sessions are opportunistically deleted.
 */
export async function resolveSession(token: string) {
  const tokenHash = hashToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: { teacher: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { tokenHash } }).catch(() => {
      // Already gone (e.g. a concurrent logout) - not an error worth surfacing.
    });
    return null;
  }

  return session.teacher;
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.authSession.delete({ where: { tokenHash } }).catch(() => {
    // Already gone - logout is idempotent from the client's point of view.
  });
}
