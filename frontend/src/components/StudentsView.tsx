import { useMemo, useState } from 'react';

import { formatGpa } from '../engine/rules';
import type { Dataset, StudentResult } from '../engine/types';
import { downloadCsv } from '../lib/format';
import { Card, FlagList, GradeBadge } from './ui';

type SortKey = 'roll' | 'name' | 'gpa';
type FlagFilter = 'any' | 'optional' | 'practical' | 'absent';
type ResultFilter = 'all' | 'published' | 'cancelled';

const LETTERS = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];

export function StudentsView({
  results,
  dataset,
  onOpenStudent,
}: {
  results: StudentResult[];
  dataset: Dataset;
  onOpenStudent: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [letter, setLetter] = useState('all');
  const [flag, setFlag] = useState<FlagFilter>('any');
  const [outcome, setOutcome] = useState<ResultFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'roll',
    dir: 'asc',
  });

  // Roll order means "class order from the dataset, then roll", not alphabetical class id.
  const classOrder = useMemo(
    () => new Map(dataset.classes.map((c, i) => [c.id, i])),
    [dataset.classes],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = results.filter((r) => {
      if (classId !== 'all' && r.student.classId !== classId) return false;
      if (letter !== 'all' && r.letter !== letter) return false;
      if (outcome === 'published' && !r.passed) return false;
      if (outcome === 'cancelled' && r.passed) return false;
      if (flag === 'optional' && !r.flags.optionalRule) return false;
      if (flag === 'practical' && !r.flags.practicalFail) return false;
      if (flag === 'absent' && !r.flags.absent) return false;
      if (!needle) return true;
      return (
        r.student.name.toLowerCase().includes(needle) ||
        r.student.id.toLowerCase().includes(needle) ||
        String(r.student.roll) === needle
      );
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'name') return dir * a.student.name.localeCompare(b.student.name);
      if (sort.key === 'gpa') {
        return dir * (a.gpa - b.gpa || a.uncancelledGpa - b.uncancelledGpa);
      }
      const byClass =
        (classOrder.get(a.student.classId) ?? 0) - (classOrder.get(b.student.classId) ?? 0);
      return byClass !== 0 ? byClass : dir * (a.student.roll - b.student.roll);
    });
  }, [results, query, classId, letter, flag, outcome, sort, classOrder]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'gpa' ? 'desc' : 'asc' },
    );
  }

  function exportCsv() {
    downloadCsv('results.csv', [
      ['Student ID', 'Roll', 'Name', 'Class', 'Optional', 'Compulsory GP sum', 'Optional credit', 'GPA', 'Letter', 'Result', 'Flags'],
      ...rows.map((r) => [
        r.student.id,
        r.student.roll,
        r.student.name,
        r.className,
        r.optional?.name ?? '',
        r.compulsorySum.toFixed(2),
        r.optionalCredit.toFixed(2),
        formatGpa(r.gpa),
        r.letter,
        r.passed ? 'Published' : 'Cancelled',
        [r.flags.absent && 'AB', r.flags.practicalFail && 'PRAC', r.flags.optionalRule && 'OPT']
          .filter(Boolean)
          .join(' '),
      ]),
    ]);
  }

  const arrow = (key: SortKey) =>
    sort.key === key ? <span className="sort-arrow">{sort.dir === 'asc' ? '↑' : '↓'}</span> : null;

  return (
    <Card
      title={`${rows.length} of ${results.length} students`}
      description="A row shows the two halves of the formula before the GPA, so the arithmetic is checkable at a glance."
      actions={
        <>
          <label className="field">
            <span className="field__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              placeholder="Name or roll"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search students"
            />
          </label>

          <label className="field">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
              <option value="all">All classes</option>
              {dataset.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <select value={letter} onChange={(e) => setLetter(e.target.value)} aria-label="Letter grade">
              <option value="all">Any grade</option>
              {LETTERS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <select
              value={flag}
              onChange={(e) => setFlag(e.target.value as FlagFilter)}
              aria-label="Checking list flag"
            >
              <option value="any">Any flag</option>
              <option value="optional">Optional rule</option>
              <option value="practical">Practical fail</option>
              <option value="absent">Absent</option>
            </select>
          </label>

          <div className="toggle" role="group" aria-label="Result">
            {(['all', 'published', 'cancelled'] as ResultFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={outcome === value}
                onClick={() => setOutcome(value)}
              >
                {value === 'all' ? 'All' : value === 'published' ? 'Published' : 'Cancelled'}
              </button>
            ))}
          </div>

          <button type="button" className="btn" onClick={exportCsv}>
            Export CSV
          </button>
        </>
      }
      bodyless
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort('roll')}>
                Roll {arrow('roll')}
              </th>
              <th className="sortable" onClick={() => toggleSort('name')}>
                Student {arrow('name')}
              </th>
              <th>Optional subject</th>
              <th className="right">Compulsory GP</th>
              <th className="right">Optional credit</th>
              <th className="right sortable" onClick={() => toggleSort('gpa')}>
                GPA {arrow('gpa')}
              </th>
              <th className="center">Grade</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.student.id}
                className={`clickable${r.passed ? '' : ' is-cancelled'}`}
                onClick={() => onOpenStudent(r.student.id)}
              >
                <td className="num dim">{r.student.roll}</td>
                <td>
                  <strong>{r.student.name}</strong>
                  <div className="dim" style={{ fontSize: 12 }}>
                    {r.className}
                    {r.student.edgeCase ? ' · edge case' : ''}
                  </div>
                </td>
                <td>
                  {r.optional?.name ?? '-'}
                  <div className="dim num" style={{ fontSize: 12 }}>
                    GP {r.optionalGradePoint.toFixed(2)}
                  </div>
                </td>
                <td className="right num">{r.compulsorySum.toFixed(2)}</td>
                <td className="right num">
                  {r.optionalCredit > 0 ? (
                    `+${r.optionalCredit.toFixed(2)}`
                  ) : (
                    <span className="dim">0.00</span>
                  )}
                </td>
                <td className="right num" style={{ fontWeight: 600 }}>
                  {formatGpa(r.gpa)}
                  {!r.passed ? (
                    <div className="dim" style={{ fontSize: 11.5, fontWeight: 400 }}>
                      was {formatGpa(r.uncancelledGpa)}
                    </div>
                  ) : null}
                </td>
                <td className="center">
                  <GradeBadge letter={r.letter} />
                </td>
                <td>
                  <FlagList flags={r.flags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="empty">No student matches these filters.</div> : null}
      </div>
    </Card>
  );
}
