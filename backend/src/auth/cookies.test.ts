import type { Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The bug this locks in: frontend (Vercel) and backend (Render) are
 * different domains in production - a genuinely cross-site request. A
 * SameSite=Lax cookie is not sent on cross-site fetch/XHR (only top-level
 * navigations), so login would succeed but the very next API call would
 * 401 as if unauthenticated. Confirmed live before this fix. `isProduction`
 * is read once at module load, so each case needs an isolated re-import
 * with NODE_ENV set first.
 */
async function loadCookiesWith(nodeEnv: "development" | "production") {
  vi.resetModules();
  process.env.NODE_ENV = nodeEnv;
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  return import("./cookies.js");
}

function fakeResponse() {
  const calls: { cookie?: [string, string, Record<string, unknown>]; clear?: [string, Record<string, unknown>] } = {};
  const res = {
    cookie: (name: string, value: string, opts: Record<string, unknown>) => {
      calls.cookie = [name, value, opts];
    },
    clearCookie: (name: string, opts: Record<string, unknown>) => {
      calls.clear = [name, opts];
    },
  } as unknown as Response;
  return { res, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session cookie policy", () => {
  it("uses SameSite=Lax, non-secure in development (same-site over http)", async () => {
    const { setSessionCookie } = await loadCookiesWith("development");
    const { res, calls } = fakeResponse();

    setSessionCookie(res, "token", new Date(Date.now() + 1000));

    expect(calls.cookie?.[2]).toMatchObject({ sameSite: "lax", secure: false, httpOnly: true });
  });

  it("uses SameSite=None, secure in production (cross-site: Vercel <-> Render)", async () => {
    const { setSessionCookie } = await loadCookiesWith("production");
    const { res, calls } = fakeResponse();

    setSessionCookie(res, "token", new Date(Date.now() + 1000));

    expect(calls.cookie?.[2]).toMatchObject({ sameSite: "none", secure: true, httpOnly: true });
  });

  it("clears with the same policy it was set with, in both environments", async () => {
    const dev = await loadCookiesWith("development");
    const devRes = fakeResponse();
    dev.clearSessionCookie(devRes.res);
    expect(devRes.calls.clear?.[1]).toMatchObject({ sameSite: "lax", secure: false });

    const prod = await loadCookiesWith("production");
    const prodRes = fakeResponse();
    prod.clearSessionCookie(prodRes.res);
    expect(prodRes.calls.clear?.[1]).toMatchObject({ sameSite: "none", secure: true });
  });
});
