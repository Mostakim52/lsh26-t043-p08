import type { Dataset } from '../engine/types';

/**
 * Where marks come from. Today it is the sample JSON served from /public; when the
 * backend is ready, point VITE_RESULTS_URL at its endpoint and nothing else changes,
 * because the grading engine runs on the same Dataset shape either way.
 */
const SOURCE = import.meta.env.VITE_RESULTS_URL ?? '/data/sample-results.json';

export async function loadDataset(): Promise<Dataset> {
  const response = await fetch(SOURCE);
  if (!response.ok) {
    throw new Error(`Could not load marks from ${SOURCE} (HTTP ${response.status})`);
  }
  return (await response.json()) as Dataset;
}
