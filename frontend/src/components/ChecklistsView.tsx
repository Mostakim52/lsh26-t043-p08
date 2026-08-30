import { useMemo, useState } from 'react';

import type { Checklist, ChecklistId } from '../engine/checklists';
import { multiListStudents } from '../engine/checklists';
import { formatGpa } from '../engine/rules';
import type { StudentResult } from '../engine/types';
import { downloadCsv } from '../lib/format';
import { Callout, Card, GradeBadge, RuleChip } from './ui';

const LIST_LABEL: Record<ChecklistId, string> = {
  optional: 'Optional rule',
  practical: 'Practical fail',
  absent: 'Absent',
};

export function ChecklistsView({
  lists,
  results,
  onOpenStudent,
}: {
  lists: Checklist[];
  results: StudentResult[];
  onOpenStudent: (id: string) => void;
}) {
  const [active, setActive] = useState<ChecklistId>('optional');
  const list = lists.find((l) => l.id === active) ?? lists[0];
  const multi = useMemo(() => multiListStudents(lists), [lists]);

  const membership = useMemo(() => {
    const map = new Map<string, ChecklistId[]>();
    for (const l of lists) {
      for (const e of l.entries) {
        map.set(e.result.student.id, [...(map.get(e.result.student.id) ?? []), l.id]);
      }
    }
    return map;
  }, [lists]);

  function exportCsv() {
    downloadCsv(`checking-list-${list.id}.csv`, [
      ['Roll', 'Student ID', 'Name', 'Class', 'GPA', 'Grade', 'Result', 'What to verify', 'Also on'],
      ...list.entries.map((e) => [
        e.result.student.roll,
        e.result.student.id,
        e.result.student.name,
        e.result.className,
        formatGpa(e.result.gpa),
        e.result.letter,
        e.result.passed ? 'Published' : 'Cancelled',
        e.reason,
        (membership.get(e.result.student.id) ?? [])
          .filter((id) => id !== list.id)
          .map((id) => LIST_LABEL[id])
          .join(' + ') || '-',
      ]),
    ]);
  }

  return (
    <>
      <div className="tabs no-print">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            className="tab"
            aria-pressed={l.id === active}
            onClick={() => setActive(l.id)}
          >
            {l.title}
            <span className="tab__count">{l.entries.length}</span>
          </button>
        ))}
      </div>

      {multi.size > 0 ? (
        <Callout tone="warn" mark="2" title={`${multi.size} students appear on more than one list`}>
          Two rules touched the same result, so the office should verify these records first. They
          are marked <em>Also on</em> in the tables below.
        </Callout>
      ) : null}

      <Card
        title={`${list.title} · ${list.entries.length} students`}
        description={
          <>
            {list.description} <RuleChip id={list.ruleId} />
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
        bodyless
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Roll</th>
                <th>Student</th>
                <th className="right">GPA</th>
                <th className="center">Grade</th>
                <th>What a teacher checks by hand</th>
                <th>Also on</th>
              </tr>
            </thead>
            <tbody>
              {list.entries.map((entry) => {
                const others = (membership.get(entry.result.student.id) ?? []).filter(
                  (id) => id !== list.id,
                );
                return (
                  <tr
                    key={entry.result.student.id}
                    className={`clickable${entry.result.passed ? '' : ' is-cancelled'}`}
                    onClick={() => onOpenStudent(entry.result.student.id)}
                  >
                    <td className="num dim">{entry.result.student.roll}</td>
                    <td>
                      <strong>{entry.result.student.name}</strong>
                      <div className="dim" style={{ fontSize: 12 }}>
                        {entry.result.className} · {entry.result.student.id}
                      </div>
                    </td>
                    <td className="right num" style={{ fontWeight: 600 }}>
                      {formatGpa(entry.result.gpa)}
                    </td>
                    <td className="center">
                      <GradeBadge letter={entry.result.letter} />
                    </td>
                    <td>
                      <span className="rule-text">{entry.reason}</span>
                    </td>
                    <td>
                      {others.length ? (
                        <span className="badge badge--mid">
                          {others.map((id) => LIST_LABEL[id]).join(' + ')}
                        </span>
                      ) : (
                        <span className="dim">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.entries.length === 0 ? (
            <div className="empty">No student on this list.</div>
          ) : null}
        </div>
      </Card>

      <Card title="Coverage" description="How much of the cohort each list touches.">
        <div className="dist dist--labelled">
          {lists.map((l) => (
            <div className="dist__row" key={l.id}>
              <div className="dist__name">{l.title}</div>
              <div className="dist__bar">
                <div
                  className="dist__fill"
                  style={{
                    width: `${(l.entries.length / results.length) * 100}%`,
                    background:
                      l.id === 'absent'
                        ? 'var(--fail)'
                        : l.id === 'practical'
                          ? 'var(--warn)'
                          : 'var(--accent)',
                    opacity: 0.85,
                  }}
                />
              </div>
              <div className="dist__val">
                {l.entries.length}
                <span className="dim">
                  {'  '}
                  {((l.entries.length / results.length) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
