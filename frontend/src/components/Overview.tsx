import { useMemo } from 'react';

import type { View } from '../App';
import type { Checklist } from '../engine/checklists';
import { multiListStudents } from '../engine/checklists';
import { formatGpa } from '../engine/rules';
import type { Dataset, StudentResult } from '../engine/types';
import { TONE_VAR, gradeTone } from '../lib/format';
import { Card, GradeBadge, Stat } from './ui';

const LETTER_ORDER = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];

export function Overview({
  dataset,
  results,
  lists,
  onOpenStudent,
  onGo,
}: {
  dataset: Dataset;
  results: StudentResult[];
  lists: Checklist[];
  onOpenStudent: (id: string) => void;
  onGo: (view: View) => void;
}) {
  const published = results.filter((r) => r.passed);
  const cancelled = results.filter((r) => !r.passed);
  const averageGpa = published.length
    ? published.reduce((sum, r) => sum + r.gpa, 0) / published.length
    : 0;

  const distribution = useMemo(() => {
    const counts = new Map(LETTER_ORDER.map((l) => [l, 0]));
    for (const r of results) counts.set(r.letter, (counts.get(r.letter) ?? 0) + 1);
    return LETTER_ORDER.map((letter) => ({ letter, count: counts.get(letter) ?? 0 }));
  }, [results]);

  const peak = Math.max(1, ...distribution.map((d) => d.count));
  const multi = multiListStudents(lists);
  const flagged = new Set(lists.flatMap((l) => l.entries.map((e) => e.result.student.id)));
  const edgeCases = results.filter((r) => r.student.edgeCase);

  return (
    <>
      <div className="grid grid--stats">
        <Stat
          label="Students processed"
          value={results.length}
          hint={`${dataset.classes.length} classes · 6 compulsory + 1 optional each`}
        />
        <Stat
          label="Results published"
          value={published.length}
          hint={`${((published.length / results.length) * 100).toFixed(1)}% of the cohort`}
          tone="pass"
        />
        <Stat
          label="Cancelled to F"
          value={cancelled.length}
          hint="At least one compulsory failure or AB"
          tone="fail"
        />
        <Stat
          label="Average GPA"
          value={formatGpa(averageGpa)}
          hint="Published results only"
        />
        <Stat
          label="Needs hand-checking"
          value={flagged.size}
          hint={`${multi.size} of them on more than one list`}
          tone="warn"
        />
      </div>

      <div className="grid grid--two">
        <Card
          title="Letter grade distribution"
          description="Read from the final GPA after cancellation, so every cancelled result sits in F."
        >
          <div className="dist">
            {distribution.map((row) => (
              <div className="dist__row" key={row.letter}>
                <GradeBadge letter={row.letter} />
                <div className="dist__bar">
                  <div
                    className="dist__fill"
                    style={{
                      width: `${(row.count / peak) * 100}%`,
                      background: TONE_VAR[gradeTone(row.letter)],
                      opacity: row.count ? 0.85 : 0,
                    }}
                  />
                </div>
                <div className="dist__val">
                  {row.count}
                  <span className="dim">
                    {'  '}
                    {((row.count / results.length) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="By class" description="Both sections sat the same six compulsory subjects." bodyless>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="right">Sat</th>
                  <th className="right">Passed</th>
                  <th className="right">Cancelled</th>
                  <th className="right">Avg GPA</th>
                  <th className="right">Best</th>
                </tr>
              </thead>
              <tbody>
                {dataset.classes.map((cls) => {
                  const rows = results.filter((r) => r.student.classId === cls.id);
                  const ok = rows.filter((r) => r.passed);
                  const avg = ok.length ? ok.reduce((s, r) => s + r.gpa, 0) / ok.length : 0;
                  const best = ok.length ? Math.max(...ok.map((r) => r.gpa)) : 0;
                  return (
                    <tr key={cls.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong>{cls.name}</strong>
                        <div className="dim" style={{ fontSize: 12 }}>
                          {cls.session}
                        </div>
                      </td>
                      <td className="right num">{rows.length}</td>
                      <td className="right num">{ok.length}</td>
                      <td className="right num" style={{ color: 'var(--fail)' }}>
                        {rows.length - ok.length}
                      </td>
                      <td className="right num">{formatGpa(avg)}</td>
                      <td className="right num">{formatGpa(best)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Checking list load"
        description="Each list is built independently, so a student can appear on more than one."
        actions={
          <button type="button" className="btn" onClick={() => onGo('checklists')}>
            Open checking lists
          </button>
        }
      >
        <div className="grid grid--stats">
          {lists.map((list) => (
            <Stat
              key={list.id}
              label={list.title}
              value={list.entries.length}
              hint={list.id === 'optional' ? 'Optional GP 2.00 or below' : list.id === 'practical' ? 'Practical below 8 / 25' : 'AB in any subject'}
              tone={list.id === 'absent' ? 'fail' : list.id === 'practical' ? 'warn' : undefined}
            />
          ))}
          <Stat
            label="On more than one list"
            value={multi.size}
            hint="Check these first"
          />
        </div>
      </Card>

      <Card
        title="Seeded edge cases"
        description={`${edgeCases.length} records were written by hand so every rule boundary can be checked against the marks. Open one to read its trace.`}
        bodyless
      >
        <div className="spotlight">
          {edgeCases.map((r) => (
            <button
              type="button"
              className="spotlight__row"
              key={r.student.id}
              onClick={() => onOpenStudent(r.student.id)}
            >
              <div>
                <div className="spotlight__name">{r.student.name}</div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {r.className} · Roll {r.student.roll}
                </div>
              </div>
              <div className="spotlight__why">{r.student.edgeCase}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>
                  {formatGpa(r.gpa)}
                </span>
                <GradeBadge letter={r.letter} />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
