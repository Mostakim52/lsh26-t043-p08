import { useEffect, useMemo, useState } from 'react';

import { buildChecklists } from './engine/checklists';
import { evaluateDataset } from './engine';
import type { Dataset } from './engine/types';
import { loadDataset } from './lib/api';
import { ChecklistsView } from './components/ChecklistsView';
import { Overview } from './components/Overview';
import { RulesView } from './components/RulesView';
import { StudentsView } from './components/StudentsView';
import { TraceView } from './components/TraceView';

export type View = 'overview' | 'students' | 'checklists' | 'rules';

const TITLES: Record<View, { title: string; blurb: string }> = {
  overview: {
    title: 'Result overview',
    blurb: 'Where the cohort landed, and how much hand-checking the office is looking at.',
  },
  students: {
    title: 'Students',
    blurb: 'Every processed result. Open a student for the subject-by-subject calculation trace.',
  },
  checklists: {
    title: 'Checking lists',
    blurb: 'The three lists a teacher verifies by hand before results go out (R-29).',
  },
  rules: {
    title: 'Rules the engine ran',
    blurb: 'Thresholds, scales and formulas, rendered from the same constants the calculation uses.',
  },
};

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  useEffect(() => {
    loadDataset()
      .then(setDataset)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Moving between views should start at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, openStudentId]);

  const results = useMemo(() => (dataset ? evaluateDataset(dataset) : []), [dataset]);
  const lists = useMemo(() => buildChecklists(results), [results]);
  const flaggedCount = useMemo(
    () => new Set(lists.flatMap((l) => l.entries.map((e) => e.result.student.id))).size,
    [lists],
  );

  function openStudent(id: string) {
    setOpenStudentId(id);
    setView('students');
  }

  function go(next: View) {
    setView(next);
    if (next !== 'students') setOpenStudentId(null);
  }

  const open = openStudentId ? results.find((r) => r.student.id === openStudentId) ?? null : null;
  const heading = open
    ? { title: open.student.name, blurb: `${open.className} · Roll ${open.student.roll} · calculation trace` }
    : TITLES[view];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <span aria-hidden="true">GP</span>
            Result office
          </div>
          <div className="brand__title">{dataset?.meta.school ?? 'Result processing'}</div>
          <div className="brand__sub">
            {dataset ? `${dataset.meta.exam} · ${dataset.meta.session}` : 'Loading marks...'}
          </div>
        </div>

        <nav className="nav">
          <div className="nav__label">Processing</div>
          <NavItem id="overview" label="Overview" current={view} onGo={go} />
          <NavItem id="students" label="Students" current={view} onGo={go} count={results.length} />
          <NavItem
            id="checklists"
            label="Checking lists"
            current={view}
            onGo={go}
            count={flaggedCount}
          />
          <NavItem id="rules" label="Rules" current={view} onGo={go} />
        </nav>

        <div className="sidebar__foot">
          <div>
            Team <strong>t043</strong> · Problem <strong>p09</strong>
          </div>
          <div>LSH26-8490-C900</div>
          <div>Frontend · GPA engine</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{heading.title}</h1>
            <p>{heading.blurb}</p>
          </div>
        </header>

        <div className="content">
          {error ? (
            <div className="card">
              <div className="empty">
                <strong>Marks could not be loaded.</strong>
                <div style={{ marginTop: 6 }}>{error}</div>
              </div>
            </div>
          ) : !dataset ? (
            <div className="card">
              <div className="empty">Loading marks...</div>
            </div>
          ) : view === 'overview' ? (
            <Overview
              dataset={dataset}
              results={results}
              lists={lists}
              onOpenStudent={openStudent}
              onGo={go}
            />
          ) : view === 'students' ? (
            open ? (
              <TraceView
                result={open}
                results={results}
                onClose={() => setOpenStudentId(null)}
                onOpenStudent={openStudent}
              />
            ) : (
              <StudentsView results={results} dataset={dataset} onOpenStudent={openStudent} />
            )
          ) : view === 'checklists' ? (
            <ChecklistsView lists={lists} results={results} onOpenStudent={openStudent} />
          ) : (
            <RulesView />
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  id,
  label,
  current,
  onGo,
  count,
}: {
  id: View;
  label: string;
  current: View;
  onGo: (v: View) => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      className="nav__item"
      aria-current={current === id}
      onClick={() => onGo(id)}
    >
      {label}
      {count !== undefined ? <span className="nav__count">{count}</span> : null}
    </button>
  );
}
