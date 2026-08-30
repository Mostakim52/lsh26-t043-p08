import { useCallback, useEffect, useState } from 'react';

/**
 * Three states, not two. "system" follows the operating system and is the
 * default; choosing light or dark stamps data-theme on <html> and wins over it.
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'gpa-console.theme';

function read(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
  }, [theme]);

  /** Cycle light -> dark -> system, so all three are reachable from one button. */
  const cycle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'));
  }, []);

  return { theme, setTheme, cycle };
}
