import { MARKS, formatGpa } from '../engine/rules';
import type { StudentResult } from '../engine/types';
import { Callout, Card, GradeBadge, RuleChip } from './ui';

export function TraceView({
  result,
  results,
  onClose,
  onOpenStudent,
}: {
  result: StudentResult;
  results: StudentResult[];
  onClose: () => void;
  onOpenStudent: (id: string) => void;
}) {
  const index = results.findIndex((r) => r.student.id === result.student.id);
  const prev = index > 0 ? results[index - 1] : null;
  const next = index < results.length - 1 ? results[index + 1] : null;

  return (
    <>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
        className="no-print"
      >
        <button type="button" className="backlink" onClick={onClose}>
          ← All students
        </button>
        <div className="pager">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!prev}
            onClick={() => prev && onOpenStudent(prev.student.id)}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!next}
            onClick={() => next && onOpenStudent(next.student.id)}
          >
            Next →
          </button>
        </div>
      </div>

      <section className="card">
        <div className="trace-head">
          <div>
            <div className="trace-head__id">{result.student.id}</div>
            <h2>{result.student.name}</h2>
            <div className="trace-head__meta">
              <span>{result.className}</span>
              <span>Roll {result.student.roll}</span>
              <span>Optional: {result.optional?.name ?? 'none'}</span>
              <span>Average mark {result.averageMark.toFixed(2)} / 100</span>
            </div>
          </div>

          <div className="gpa-block">
            <div className="gpa-block__figure">
              <div className="gpa-block__label">Reported GPA</div>
              <div className={`gpa-block__value${result.passed ? '' : ' is-cancelled'}`}>
                {formatGpa(result.gpa)}
              </div>
              {!result.passed ? (
                <div className="dim" style={{ fontSize: 12 }}>
                  uncancelled {formatGpa(result.uncancelledGpa)}
                </div>
              ) : null}
            </div>
            <GradeBadge letter={result.letter} />
          </div>
        </div>
      </section>

      {!result.passed ? (
        <Callout tone="fail" mark="!" title={`Result cancelled by ${result.cancelledBy.map((s) => s.name).join(' and ')}`}>
          The seven subjects averaged{' '}
          <strong className="num">{formatGpa(result.uncancelledGpa)}</strong> before cancellation
          (average mark <span className="num">{result.averageMark.toFixed(2)}</span> / 100), but{' '}
          {result.cancelledBy.map((s, i) => (
            <span key={s.code}>
              {i > 0 ? ' and ' : ''}
              <strong>{s.name}</strong>{' '}
              {s.status === 'absent' ? (
                <>was marked AB</>
              ) : (
                <>
                  scored <span className="num">{s.markUsed}</span>
                </>
              )}
            </span>
          ))}
          . A compulsory failure is reported as GPA 0.00 and letter F.
        </Callout>
      ) : null}

      {result.student.edgeCase ? (
        <Callout tone="info" mark="i" title="Seeded edge case">
          {result.student.edgeCase}
        </Callout>
      ) : null}

      <Card
        title="Subject trace"
        description={`Practical subjects are marked out of ${MARKS.theoryMax} theory and ${MARKS.practicalMax} practical; written-only subjects are a single paper out of ${MARKS.writtenOnlyMax}. Every row names the rule that decided its grade point.`}
        bodyless
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th className="right">Theory</th>
                <th className="right">Practical</th>
                <th className="right">Mark used</th>
                <th className="right">GP</th>
                <th className="center">Grade</th>
                <th>Rule that decided it</th>
              </tr>
            </thead>
            <tbody>
              {result.subjects.map((s) => (
                <tr
                  key={s.code}
                  className={[
                    s.status === 'pass' ? '' : 'subject-row--fail',
                    s.kind === 'optional' ? 'subject-row--optional' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td>
                    <strong>{s.name}</strong>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {s.code} · {s.kind}
                      {s.hasPractical ? ' · has practical' : ''}
                    </div>
                  </td>
                  <td className="right num">
                    {s.status === 'absent' ? (
                      <span style={{ color: 'var(--fail)' }}>AB</span>
                    ) : (
                      <>
                        {s.theory}
                        <span className="dim">
                          /{s.hasPractical ? MARKS.theoryMax : MARKS.writtenOnlyMax}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="right num">
                    {s.status === 'absent' ? (
                      <span style={{ color: 'var(--fail)' }}>AB</span>
                    ) : s.practical === null ? (
                      <span className="dim">-</span>
                    ) : (
                      <span style={{ color: s.practicalFailed ? 'var(--fail)' : undefined }}>
                        {s.practical}
                        <span className="dim">/{MARKS.practicalMax}</span>
                      </span>
                    )}
                  </td>
                  <td className="right num">{s.markUsed}</td>
                  <td className="right num" style={{ fontWeight: 600 }}>
                    {s.gradePoint.toFixed(2)}
                  </td>
                  <td className="center">
                    <GradeBadge letter={s.letter} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <RuleChip id={s.ruleId} />
                      <span className="rule-text">{s.rule}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="GPA calculation"
        description="GPA = (sum of the compulsory grade points + max(0, optional grade point - 2)) / 6, capped at 5.00."
        bodyless
      >
        <div className="ledger">
          {result.trace.map((step, i) => (
            <div
              key={step.label}
              className={`ledger__step${step.emphasis ? ` ledger__step--${step.emphasis}` : ''}`}
            >
              <div className="ledger__n">{i + 1}</div>
              <div>
                <div className="ledger__label">
                  {step.label}
                  {step.ruleId ? <RuleChip id={step.ruleId} /> : null}
                </div>
                <div className="ledger__detail">{step.detail}</div>
              </div>
              <div className="ledger__value">{step.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
