import { useTheme, type Theme } from '../lib/theme';

const NEXT_LABEL: Record<Theme, string> = {
  light: 'Switch to dark',
  dark: 'Follow system theme',
  system: 'Switch to light',
};

const CURRENT_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/** One button cycling light → dark → system. */
export function ThemeToggle() {
  const { theme, cycle } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      title={NEXT_LABEL[theme]}
      aria-label={`Theme: ${CURRENT_LABEL[theme]}. ${NEXT_LABEL[theme]}.`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <SystemIcon />}
      </span>
      <span className="theme-toggle__text">{CURRENT_LABEL[theme]}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.2" />
      <path
        strokeLinecap="round"
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinejoin="round" d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.8" y="4.4" width="18.4" height="12.4" rx="1.8" />
      <path strokeLinecap="round" d="M8.6 20.2h6.8" />
    </svg>
  );
}
