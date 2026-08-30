import type { ReactNode } from 'react';

import { gradeTone } from '../lib/format';
import { RULES } from '../engine/rules';
import type { StudentFlags } from '../engine/types';

export function GradeBadge({ letter }: { letter: string }) {
  return <span className={`badge badge--grade badge--${gradeTone(letter)}`}>{letter}</span>;
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'pass' | 'fail' | 'warn';
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}

/** A rule reference the judge can hover to read in full. */
export function RuleChip({ id }: { id: string }) {
  const rule = RULES[id];
  return (
    <span className="rule-chip" title={rule ? `${rule.title} - ${rule.text}` : id}>
      {id === 'GS' ? 'Grade scale' : id}
    </span>
  );
}

export function FlagList({ flags }: { flags: StudentFlags }) {
  if (!flags.optionalRule && !flags.practicalFail && !flags.absent) {
    return <span className="dim">-</span>;
  }
  return (
    <span className="flags">
      {flags.absent ? (
        <span className="flag flag--ab" title="AB in at least one subject">
          AB
        </span>
      ) : null}
      {flags.practicalFail ? (
        <span className="flag flag--prac" title="A practical part below 8 / 25">
          PRAC
        </span>
      ) : null}
      {flags.optionalRule ? (
        <span className="flag flag--opt" title="Optional grade point 2.00 or below">
          OPT
        </span>
      ) : null}
    </span>
  );
}

export function Callout({
  tone,
  mark,
  title,
  children,
}: {
  tone: 'fail' | 'info' | 'warn';
  mark: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      <span className="callout__mark" aria-hidden="true">
        {mark}
      </span>
      <div>
        <div className="callout__title">{title}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  bodyless,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyless?: boolean;
}) {
  return (
    <section className="card">
      {title ? (
        <header className="card__head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="controls">{actions}</div> : null}
        </header>
      ) : null}
      {bodyless ? children : <div className="card__body">{children}</div>}
    </section>
  );
}
