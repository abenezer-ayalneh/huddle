'use client';

import { Moon, Sun } from 'lucide-react';
import { useLandingTheme } from '@/components/landing/LandingThemeProvider';

export default function CallThemeToggle() {
  const { theme, toggleTheme } = useLandingTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  return (
    <button
      type="button"
      className="signal-call-theme-toggle"
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
    >
      <ThemeIcon className="size-4" aria-hidden="true" />
    </button>
  );
}
