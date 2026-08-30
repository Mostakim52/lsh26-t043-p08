import type { Response } from "express";

import { isProduction } from "../config/env.js";
import { SESSION_COOKIE_NAME } from "./session.js";

/**
 * httpOnly so page script can never read the token (the frontend's own
 * design goal - see CLAUDE.md's Authentication section).
 *
 * SameSite/secure depend on whether frontend and backend actually share a
 * site:
 *   - local dev: both run on localhost (different ports, same site), so
 *     Lax + non-secure works over plain http.
 *   - production: the frontend (Vercel) and backend (Render) are on
 *     completely different domains - a genuinely cross-site request. Lax
 *     cookies are NOT sent on cross-site fetch/XHR (only top-level
 *     navigations), so this requires None, which in turn requires Secure.
 * Confirmed live: with Lax in production, login succeeded but the very next
 * fetch to /results came back 401 - the cookie was set but never sent back.
 */
const baseCookieOptions = {
  httpOnly: true,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  secure: isProduction,
  path: "/",
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions);
}
