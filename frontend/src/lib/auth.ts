/**
 * Teacher sign-in. The frontend does NO authentication of its own: it has no
 * account list, no password comparison and no session-validity logic. Every
 * decision is the backend's. This module is a thin transport over three
 * endpoints, and its only local state is the profile it renders in the sidebar.
 *
 *   POST {AUTH_BASE}/login    { username, password } -> Teacher | 401
 *   GET  {AUTH_BASE}/session  -> Teacher | 401
 *   POST {AUTH_BASE}/logout   -> 204
 *
 * The session itself lives in an httpOnly cookie the backend sets, which is why
 * every call passes `credentials: 'include'` and nothing is kept in
 * localStorage or sessionStorage — a token the page can read is a token an XSS
 * can steal. Full contract in the repo-root CLAUDE.md.
 */

import { AUTH_BASE } from './config';

export interface Teacher {
  username: string;
  name: string;
  role: string;
  /** Classes this teacher may see. '*' means the whole cohort. */
  scope: string;
}

/* -------------------------------------------------------------------------- */
/* TEMPORARY: preview without the backend                                      */
/* -------------------------------------------------------------------------- */
/**
 * Scaffolding while the backend is being written, so the portal can be walked
 * end to end. Submitting the form with BOTH FIELDS EMPTY opens a preview
 * session backed by the bundled sample marks.
 *
 * `import.meta.env.DEV` is false in `vite build`, and Vite folds the constant at
 * build time, so this branch and its message are dropped from the production
 * bundle entirely. It cannot ship by accident.
 *
 * DELETE THIS BLOCK, and the `preview` flag it feeds, once /auth/login is live.
 */
export const PREVIEW_ENABLED = import.meta.env.DEV;

const PREVIEW_TEACHER: Teacher = {
  username: 'preview',
  name: 'Preview session',
  role: 'No backend · sample marks',
  scope: '*',
};

export interface SignInSuccess {
  ok: true;
  teacher: Teacher;
  /** True only for the temporary no-backend preview above. */
  preview: boolean;
}

export type SignInResult = SignInSuccess | { ok: false; message: string };

/** Shape of the backend's error envelope, per the CLAUDE.md contract. */
interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

async function messageFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ErrorEnvelope;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function unreachable(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Could not reach the sign-in service at ${AUTH_BASE}. Start the backend, or set VITE_AUTH_URL. (${detail})`;
}

export async function signIn(username: string, password: string): Promise<SignInResult> {
  if (PREVIEW_ENABLED && username === '' && password === '') {
    return { ok: true, teacher: PREVIEW_TEACHER, preview: true };
  }

  let response: Response;
  try {
    response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    return { ok: false, message: unreachable(error) };
  }

  if (response.status === 404) {
    // Almost always "the backend is not running", not a credential problem.
    return {
      ok: false,
      message: `No sign-in service at ${AUTH_BASE}/login. Start the backend, or point VITE_AUTH_URL at it.`,
    };
  }

  if (!response.ok) {
    // The backend decides what counts as a bad credential and says so.
    return {
      ok: false,
      message: await messageFrom(
        response,
        response.status === 401
          ? 'Those details were not recognised.'
          : `Sign-in failed (HTTP ${response.status}).`,
      ),
    };
  }

  try {
    return { ok: true, teacher: (await response.json()) as Teacher, preview: false };
  } catch (error) {
    return { ok: false, message: unreachable(error) };
  }
}

/**
 * Ask the backend who, if anyone, this browser is signed in as. Returns null for
 * "nobody" — including when the service is down, because an unreachable backend
 * must not be treated as a valid session.
 */
export async function fetchSession(): Promise<Teacher | null> {
  try {
    const response = await fetch(`${AUTH_BASE}/session`, { credentials: 'include' });
    if (!response.ok) return null;
    return (await response.json()) as Teacher;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Already unreachable: the local profile is cleared by the caller regardless.
  }
}
