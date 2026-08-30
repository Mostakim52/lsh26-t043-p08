import type { Response } from "express";

import { isProduction } from "../config/env.js";
import { SESSION_COOKIE_NAME } from "./session.js";

/**
 * httpOnly so page script can never read the token (the frontend's own
 * design goal - see CLAUDE.md's Authentication section). `secure` only in
 * production since local dev runs over plain http.
 */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions);
}
