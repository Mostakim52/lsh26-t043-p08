import { useRef, useState } from 'react';

import type { Dataset } from '../engine/types';
import { createStudent, downloadResultsCsv, importCsv, type ImportResult, type MarkInput } from '../lib/marksApi';
import { Card } from './ui';

interface Props {
  dataset: Dataset;
  /** Re-fetches the dataset so a newly added/imported student shows up immediately. */
  onDataChanged: () => void;
}

type MarkDraft = Record<string, { theory: string; practical: string; absent: boolean }>;

function emptyDraft(codes: string[]): MarkDraft {
  return Object.fromEntries(codes.map((c) => [c, { theory: '', practical: '', absent: false }]));
}

export function MarksEntry({ dataset, onDataChanged }: Props) {
  const compulsory = dataset.subjects.filter((s) => s.kind === 'compulsory');
  const optionalSubjects = dataset.subjects.filter((s) => s.kind === 'optional');

  const [name, setName] = useState('');
  const [className, setClassName] = useState(dataset.classes[0]?.name ?? 'Class 9');
  const [optionalCode, setOptionalCode] = useState(optionalSubjects[0]?.code ?? '');
  const [marks, setMarks] = useState<MarkDraft>(() => emptyDraft(compulsory.map((s) => s.code)));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const activeCodes = [...compulsory.map((s) => s.code), optionalCode].filter(Boolean);
  const subjectByCode = new Map(dataset.subjects.map((s) => [s.code, s]));

  function updateMark(code: string, field: 'theory' | 'practical', value: string) {
    setMarks((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { theory: '', practical: '', absent: false }), [field]: value } }));
  }
  function toggleAbsent(code: string) {
    setMarks((prev) => ({
      ...prev,
      [code]: { theory: '', practical: '', absent: !(prev[code]?.absent ?? false) },
    }));
  }

  async function submitStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }

    const markInputs: MarkInput[] = [];
    for (const code of activeCodes) {
      const subject = subjectByCode.get(code);
      const draft = marks[code] ?? { theory: '', practical: '', absent: false };
      if (draft.absent) {
        markInputs.push({ code, absent: true });
        continue;
      }
      const theory = Number(draft.theory);
      if (draft.theory === '' || Number.isNaN(theory)) {
        setFormError(`Enter a mark for ${code}, or tick Absent.`);
        return;
      }
      if (subject?.hasPractical) {
        const practical = Number(draft.practical);
        if (draft.practical === '' || Number.isNaN(practical)) {
          setFormError(`Enter a practical mark for ${code}, or tick Absent.`);
          return;
        }
        markInputs.push({ code, theory, practical });
      } else {
        markInputs.push({ code, theory });
      }
    }

    setSubmitting(true);
    try {
      await createStudent({ name: name.trim(), className, optionalCode, marks: markInputs });
      setFormSuccess(`${name.trim()} added.`);
      setName('');
      setMarks(emptyDraft(compulsory.map((s) => s.code)));
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <Card
        title="Add a student"
        description="One student at a time, checked the same way as everything else - a bad mark is rejected here, before it ever reaches the cohort."
      >
        <form className="marks-form" onSubmit={submitStudent}>
          <div className="marks-form__row">
            <label className="field-block">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student name" />
            </label>
            <label className="field-block">
              <span>Class</span>
              <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class 9" />
            </label>
            <label className="field-block">
              <span>Optional subject</span>
              <select value={optionalCode} onChange={(e) => setOptionalCode(e.target.value)}>
                {optionalSubjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="marks-form__grid">
            {activeCodes.map((code) => {
              const subject = subjectByCode.get(code);
              const draft = marks[code] ?? { theory: '', practical: '', absent: false };
              return (
                <div className="marks-form__subject" key={code}>
                  <div className="marks-form__subject-head">
                    <strong>{subject?.name ?? code}</strong>
                    <label className="marks-form__absent">
                      <input type="checkbox" checked={draft.absent} onChange={() => toggleAbsent(code)} />
                      Absent
                    </label>
                  </div>
                  {!draft.absent && (
                    <div className="marks-form__inputs">
                      <input
                        type="number"
                        placeholder={subject?.hasPractical ? 'Theory' : 'Mark'}
                        value={draft.theory}
                        onChange={(e) => updateMark(code, 'theory', e.target.value)}
                        min={0}
                        max={subject?.hasPractical ? 75 : 100}
                      />
                      {subject?.hasPractical && (
                        <input
                          type="number"
                          placeholder="Practical"
                          value={draft.practical}
                          onChange={(e) => updateMark(code, 'practical', e.target.value)}
                          min={0}
                          max={25}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {formError ? <div className="callout callout--fail"><span className="callout__mark">!</span><div>{formError}</div></div> : null}
          {formSuccess ? <div className="callout callout--info"><span className="callout__mark">✓</span><div>{formSuccess}</div></div> : null}

          <button type="submit" className="btn btn--accent" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add student'}
          </button>
        </form>
      </Card>

      <CsvPanel onDataChanged={onDataChanged} />
    </div>
  );
}

function CsvPanel({ onDataChanged }: { onDataChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const res = await importCsv(text);
      setResult(res);
      if (res.imported > 0) onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleExport() {
    setError(null);
    try {
      await downloadResultsCsv();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Card
      title="Marks sheet (CSV)"
      description="Export the current cohort, edit it in a spreadsheet, and upload it back. Rows that don't fit the rules are reported here, not silently dropped."
      actions={
        <button type="button" className="btn" onClick={handleExport}>
          Download CSV
        </button>
      }
    >
      <label className="btn btn--accent" style={{ display: 'inline-flex', cursor: 'pointer' }}>
        {busy ? 'Uploading…' : 'Upload CSV'}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>

      {error ? (
        <div className="callout callout--fail" style={{ marginTop: 16 }}>
          <span className="callout__mark">!</span>
          <div>{error}</div>
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 16 }}>
          <div className="callout callout--info">
            <span className="callout__mark">✓</span>
            <div>
              {result.imported} of {result.totalRows} row{result.totalRows === 1 ? '' : 's'} imported.
            </div>
          </div>
          {result.rejected.length > 0 ? (
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Why it was rejected</th>
                </tr>
              </thead>
              <tbody>
                {result.rejected.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
