/**
 * Where the backend lives, resolved in one place.
 *
 * Normally you set one variable — `VITE_API_BASE` — and both endpoints follow:
 *
 *   VITE_API_BASE=http://localhost:8000/api/v1      local backend
 *   VITE_API_BASE=https://api.example.com/api/v1    deployed backend
 *
 * `VITE_RESULTS_URL` and `VITE_AUTH_URL` stay available for the odd case where
 * the two live somewhere unrelated; they win over the base when set.
 */

/** Trailing slashes are easy to leave on and would produce `//results`. */
function trimEnd(url: string): string {
  return url.replace(/\/+$/, '');
}

const BASE = trimEnd(import.meta.env.VITE_API_BASE?.trim() ?? '') || '/api/v1';

/** Whole `Dataset`: students, classes, subjects, marks. */
export const RESULTS_URL = import.meta.env.VITE_RESULTS_URL?.trim() || `${BASE}/results`;

/** Base path of /login, /session and /logout. */
export const AUTH_BASE = trimEnd(import.meta.env.VITE_AUTH_URL?.trim() ?? '') || `${BASE}/auth`;

/** Shown on the sign-in splash before any marks exist to read a name from. */
export const PORTAL_NAME = import.meta.env.VITE_PORTAL_NAME?.trim() || 'Teacher Result Portal';
export const SCHOOL_NAME =
  import.meta.env.VITE_SCHOOL_NAME?.trim() || 'Shaheed Smrity Higher Secondary School';
