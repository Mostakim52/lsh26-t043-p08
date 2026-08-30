import type { Dataset } from '../engine/types';

/**
 * Where marks come from. **Every student, class, subject and mark is fetched
 * from the backend** — the app ships no cohort of its own and computes nothing
 * from a local file on the normal path.
 *
 * `credentials: 'include'` sends the session cookie the backend set at login, so
 * the marks endpoint can refuse an unauthenticated caller.
 */
const SOURCE = import.meta.env.VITE_RESULTS_URL ?? '/api/v1/results';

/**
 * TEMPORARY, dev builds only: the bundled sample cohort behind the no-backend
 * preview session. `import.meta.env.DEV` is false in `vite build`, so neither
 * this constant nor the branch below survives into production.
 *
 * DELETE with the preview block in lib/auth.ts once /api/v1/results is live.
 */
const PREVIEW_SOURCE = '/data/sample-results.json';

export async function loadDataset(preview = false): Promise<Dataset> {
  const url = preview && import.meta.env.DEV ? PREVIEW_SOURCE : SOURCE;
  let response: Response;

  try {
    response = await fetch(url, { credentials: 'include' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the results service at ${url}. Start the backend, or set VITE_RESULTS_URL. (${detail})`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Your session is no longer valid. Sign in again to load results.');
  }
  if (response.status === 404) {
    throw new Error(`No results endpoint at ${url}. Start the backend, or point VITE_RESULTS_URL at it.`);
  }
  if (!response.ok) {
    throw new Error(`Could not load marks from ${url} (HTTP ${response.status})`);
  }

  return (await response.json()) as Dataset;
}
