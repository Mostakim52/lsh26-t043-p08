import { useEffect, useRef, useState } from 'react';

import { PREVIEW_ENABLED, signIn, type SignInSuccess } from '../lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { VaultScene } from './VaultScene';

/**
 * Display-only crib for judges and developers. These are the accounts the
 * BACKEND is specified to seed in development (see CLAUDE.md); the buttons here
 * only type them into the form. Nothing on this screen checks a password.
 */
const SEEDED_ACCOUNTS: ReadonlyArray<{
  username: string;
  password: string;
  name: string;
  role: string;
}> = [
  {
    username: 'controller',
    password: 'result2026',
    name: 'Nasrin Akter',
    role: 'Exam controller · whole cohort',
  },
  {
    username: 'teacher9a',
    password: 'class9a',
    name: 'Abdul Karim',
    role: 'Class teacher · Class 9 - Section A',
  },
];

export function SignIn({
  portal,
  school,
  onSignedIn,
}: {
  portal: string;
  school: string;
  onSignedIn: (session: SignInSuccess) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  async function attempt(user: string, pass: string) {
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await signIn(user, pass);
    if (result.ok) {
      onSignedIn(result);
    } else {
      setError(result.message);
      setPending(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void attempt(username, password);
  }

  function fill(account: (typeof SEEDED_ACCOUNTS)[number]) {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
    userRef.current?.focus();
  }

  return (
    <div className="gate">
      <div className="gate__theme">
        <ThemeToggle />
      </div>

      <div className="gate__card">
        {/* ---- left: the splash ---- */}
        <section className="gate__splash">
          <div className="gate__brandmark">
            <img className="gate__logo" src="/logo.svg" alt="" width={28} height={28} />
            Result portal
          </div>

          <VaultScene />

          <div className="gate__splashfoot">
            <h1 className="gate__portal">{portal}</h1>
            <p className="gate__school">{school}</p>
          </div>
        </section>

        {/* ---- right: the form ---- */}
        <section className="gate__panel">
          <div className="gate__form-wrap">
            <header className="gate__cardhead">
              <h2>Log in</h2>
              <p>Credentials are checked by the backend. No results reach this browser until it says yes.</p>
            </header>

            <form onSubmit={submit} className="gate__form" noValidate>
              <label className="field-block">
                <span>Username</span>
                <div className="input-shell">
                  <UserIcon />
                  <input
                    ref={userRef}
                    type="text"
                    value={username}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="controller"
                  />
                </div>
              </label>

              <label className="field-block">
                <span>Password</span>
                <div className="input-shell">
                  <LockIcon />
                  <input
                    type={reveal ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="input-shell__reveal"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? 'Hide password' : 'Show password'}
                    title={reveal ? 'Hide password' : 'Show password'}
                  >
                    {reveal ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              {error ? (
                <p className="gate__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn btn--accent btn--block" disabled={pending}>
                {pending ? 'Signing in…' : 'Log in'}
              </button>
            </form>

            {PREVIEW_ENABLED ? (
              <div className="gate__preview">
                <div className="gate__previewhead">
                  <span className="gate__devtag gate__devtag--warn">Preview</span>
                  <p>
                    The backend is not built yet. Log in with <strong>both fields empty</strong> to
                    walk the whole portal on bundled sample marks. Dev builds only — this disappears
                    from <code>npm run build</code>.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--block"
                  disabled={pending}
                  onClick={() => void attempt('', '')}
                >
                  Preview without the backend
                </button>
              </div>
            ) : null}

            {/* Judges have to be able to get in without being handed a password. */}
            <div className="gate__dev">
              <div className="gate__devhead">
                <span className="gate__devtag">Dev mode</span>
                <p>
                  Accounts the backend seeds in development. These buttons only fill the form — the
                  password is verified server-side, never here.
                </p>
              </div>

              <ul className="gate__accounts">
                {SEEDED_ACCOUNTS.map((account) => (
                  <li key={account.username}>
                    <div className="gate__account">
                      <div className="gate__accountwho">
                        <strong>{account.name}</strong>
                        <span>{account.role}</span>
                      </div>
                      <div className="gate__creds">
                        <code>{account.username}</code>
                        <code>{account.password}</code>
                      </div>
                    </div>
                    <button type="button" className="btn btn--sm" onClick={() => fill(account)}>
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <p className="gate__legal">
              Team t043 · Problem p08 · <span className="mono">LSH26-8490-C900</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* -- icons ---------------------------------------------------------------- */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function UserIcon() {
  return (
    <svg className="input-shell__icon" viewBox="0 0 24 24" width="17" height="17" {...stroke}>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.8 19.4a7.4 7.4 0 0 1 14.4 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="input-shell__icon" viewBox="0 0 24 24" width="17" height="17" {...stroke}>
      <rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2.2" />
      <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}>
      <path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}>
      <path d="M9.9 5.5a9.6 9.6 0 0 1 2.1-.2c6 0 9.4 5.8 9.4 5.8a16 16 0 0 1-2.4 3.1M6.4 7.3A15.6 15.6 0 0 0 2.6 12S6 17.8 12 17.8a9.3 9.3 0 0 0 3.7-.7" />
      <path d="m4 4 16 16" />
    </svg>
  );
}
