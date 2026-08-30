import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../api/errors.js";
import { resolveSession, SESSION_COOKIE_NAME } from "./session.js";

/**
 * Resolves the session cookie to a TeacherAccount and attaches it as
 * `req.teacher`. Throws (via ApiError, caught by the global error handler)
 * rather than writing the response directly, so every route gets the same
 * error envelope shape.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    next(new ApiError(401, "UNAUTHENTICATED", "No active session"));
    return;
  }

  const teacher = await resolveSession(token);
  if (!teacher) {
    next(new ApiError(401, "UNAUTHENTICATED", "Session is invalid or has expired"));
    return;
  }

  req.teacher = teacher;
  next();
}
