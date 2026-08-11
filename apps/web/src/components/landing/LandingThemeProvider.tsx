'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark';

export const LANDING_THEME_STORAGE_KEY = 'huddle-theme';

type LandingThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const LandingThemeContext = createContext<LandingThemeContextValue | null>(null);

function readTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light';

  try {
    const saved = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private browsing and hardened storage settings can throw. The system
    // preference remains a useful fallback for a first visit.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
}

export function useLandingTheme() {
  const context = useContext(LandingThemeContext);
  if (!context) throw new Error('useLandingTheme must be used inside LandingThemeProvider');
  return context;
}

export default function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('light');

  useEffect(() => {
    const initialTheme = readTheme();
    // The bootstrap script paints the correct theme before hydration. This
    // state sync is intentionally deferred until the client has mounted so
    // the server and client render the same initial markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme selection still works for the current visit when storage is unavailable.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);

  return <LandingThemeContext.Provider value={value}>{children}</LandingThemeContext.Provider>;
}
