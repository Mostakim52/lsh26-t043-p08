/**
 * Marks-entry and CSV endpoints. Same conventions as lib/api.ts and
 * lib/auth.ts: credentials: 'include' so the session cookie goes along,
 * and the backend's error envelope ({ error: { code, message } }) is the
 * source of truth for what went wrong.
 */
import { API_BASE } from './config';

export interface MarkInput {
  code: string;
  theory?: number;
  practical?: number;
  absent?: boolean;
}

export interface StudentInput {
  name: string;
  className: string;
  optionalCode: string;
  marks: MarkInput[];
}

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

export async function createStudent(input: StudentInput): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/students`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await messageFrom(res, `Could not create the student (HTTP ${res.status}).`));
  }
  return (await res.json()) as { id: string };
}

export interface ImportResult {
  imported: number;
  rejected: Array<{ row: number; reason: string }>;
  totalRows: number;
}

export async function importCsv(csvText: string): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText,
  });
  if (!res.ok) {
    throw new Error(await messageFrom(res, `Import failed (HTTP ${res.status}).`));
  }
  return (await res.json()) as ImportResult;
}

/** Triggers a browser download of the current cohort as CSV. */
export async function downloadResultsCsv(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/results.csv`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Could not export results (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'results.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
