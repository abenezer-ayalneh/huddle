'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import HuddleIcon from '@/components/HuddleIcon';
import { useLandingTheme } from '@/components/landing/LandingThemeProvider';

export default function LobbyHeader() {
  const { theme, toggleTheme } = useLandingTheme();

  return (
    <header className="lobby-header">
      <div className="lobby-header-inner">
        <div className="lobby-brand-shell">
          <Link href="/" className="lobby-brand" aria-label="Huddle home">
            <HuddleIcon className="lobby-brand-icon" aria-hidden="true" />
            <span>Huddle</span>
          </Link>
        </div>
        <div className="lobby-header-main">
          <div className="lobby-header-actions">
            <Link href="/" className="lobby-back-link">
              About Huddle
            </Link>
            <button
              type="button"
              className="lobby-theme-button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
