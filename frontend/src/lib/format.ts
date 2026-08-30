export type Tone = 'top' | 'good' | 'mid' | 'fail' | 'neutral';

/** Colour band for a letter grade, shared by badges and the distribution chart. */
export function gradeTone(letter: string): Tone {
  switch (letter) {
    case 'A+':
    case 'A':
      return 'top';
    case 'A-':
    case 'B':
      return 'good';
    case 'C':
    case 'D':
      return 'mid';
    case 'F':
      return 'fail';
    default:
      return 'neutral';
  }
}

export const TONE_VAR: Record<Tone, string> = {
  top: 'var(--pass)',
  good: 'var(--accent)',
  mid: 'var(--warn)',
  fail: 'var(--fail)',
  neutral: 'var(--text-3)',
};

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Hand the office a file it can open in a spreadsheet. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
