import { useEffect, useMemo, useState } from 'react';

import { buildChecklists } from './engine/checklists';
import { evaluateDataset } from './engine';
import type { Dataset } from './engine/types';
import { loadDataset } from './lib/api';
import {
  PREVIEW_ENABLED,
  fetchSession,
  signOut as postSignOut,
  type SignInSuccess,
  type Teacher,
} from './lib/auth';
import { ChecklistsView } from './components/ChecklistsView';
import { Overview } from './components/Overview';
import { RulesView } from './components/RulesView';
import { SignIn } from './components/SignIn';
import { StudentsView } from './components/StudentsView';
import { ThemeToggle } from './components/ThemeToggle';
import { TraceView } from './components/TraceView';

export type View = 'overview' | 'students' | 'checklists' | 'rules';

/** Shown on the sign-in splash, before any marks exist to read a name from. */
const PORTAL = import.meta.env.VITE_PORTAL_NAME ?? 'Teacher Result Portal';
const SCHOOL = import.meta.env.VITE_SCHOOL_NAME ?? 'Shaheed Smrity Higher Secondary School';

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
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  // TEMPORARY: true only for the dev no-backend preview session.
  const [preview, setPreview] = useState(false);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Ask the backend whether this browser already has a valid session cookie.
  // The frontend never decides this for itself.
  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((t) => !cancelled && setTeacher(t))
      .finally(() => !cancelled && setCheckingSession(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Marks are fetched only once someone is signed in, so an unauthenticated
  // page load never pulls a cohort into the browser.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    loadDataset(preview)
      .then((d) => !cancelled && setDataset(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [teacher, preview]);

  // Moving between views should start at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [view, openStudentId]);

  const results = useMemo(() => (dataset ? evaluateDataset(dataset) : []), [dataset]);
  const lists = useMemo(() => buildChecklists(results), [results]);
  const flaggedCount = useMemo(
    () => new Set(lists.flatMap((l) => l.entries.map((e) => e.result.student.id))).size,
    [lists],
  );

  function signInAs(session: SignInSuccess) {
    setPreview(session.preview);
    setTeacher(session.teacher);
  }

  async function signOut() {
    await postSignOut();
    setTeacher(null);
    setPreview(false);
    setDataset(null);
    setError(null);
    setView('overview');
    setOpenStudentId(null);
  }

  function openStudent(id: string) {
    setOpenStudentId(id);
    setView('students');
  }

  function go(next: View) {
    setView(next);
    if (next !== 'students') setOpenStudentId(null);
  }

  if (checkingSession) {
    return (
      <div className="boot">
        <img src="/logo.svg" alt="" width={34} height={34} />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!teacher) {
    return <SignIn portal={PORTAL} school={SCHOOL} onSignedIn={signInAs} />;
  }

  const open = openStudentId ? results.find((r) => r.student.id === openStudentId) ?? null : null;
  const heading = open
    ? { title: open.student.name, blurb: `${open.className} · Roll ${open.student.roll} · calculation trace` }
    : TITLES[view];

  return (
    <div className={`app${menuOpen ? ' app--menu' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <img className="brand__logo" src="/logo.svg" alt="" width={24} height={24} />
            Result portal
          </div>
          <div className="brand__title">{dataset?.meta.school ?? SCHOOL}</div>
          <div className="brand__sub">
            {dataset ? `${dataset.meta.exam} · ${dataset.meta.session}` : 'Loading marks…'}
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
          <div className="who">
            <div className="who__avatar" aria-hidden="true">
              {initials(teacher.name)}
            </div>
            <div className="who__text">
              <strong>{teacher.name}</strong>
              <span>{teacher.role}</span>
            </div>
          </div>
          <button type="button" className="btn btn--sm btn--block" onClick={signOut}>
            Sign out
          </button>
          <div className="sidebar__meta">
            <div>
              Team <strong>t043</strong> · Problem <strong>p08</strong>
            </div>
            <div>LSH26-8490-C900</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true" />
          </button>
          <div className="topbar__text">
            <h1>{heading.title}</h1>
            <p>{heading.blurb}</p>
          </div>
          <div className="topbar__actions no-print">
            <ThemeToggle />
          </div>
        </header>

        <div className="content">
          {PREVIEW_ENABLED && preview ? (
            <div className="preview-bar no-print">
              <strong>Preview session</strong>
              <span>
                Bundled sample marks, not the backend. Nothing here is a real result — sign in
                properly once <code>/api/v1/results</code> is live.
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="card">
              <div className="empty">
                <strong>Marks could not be loaded.</strong>
                <div style={{ marginTop: 6 }}>{error}</div>
              </div>
            </div>
          ) : !dataset ? (
            <div className="card">
              <div className="empty">Loading marks…</div>
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

      {/* Tapping the dimmed area closes the drawer on a phone. */}
      <button
        type="button"
        className="scrim"
        tabIndex={menuOpen ? 0 : -1}
        aria-hidden={!menuOpen}
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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
