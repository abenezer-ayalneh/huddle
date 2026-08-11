'use client';

import { Menu, Moon, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import LandingThemeProvider, { useLandingTheme } from '@/components/landing/LandingThemeProvider';
import { LandingWordmark } from '@/components/landing/LandingProductScene';

type LegalNavigationProps = {
  kind: 'privacy' | 'terms';
};

const legalRoutes = [
  { href: '/privacy', label: 'Privacy', kind: 'privacy' },
  { href: '/terms', label: 'Terms', kind: 'terms' },
] as const;

function LegalNavigationContents({ kind }: LegalNavigationProps) {
  const { theme, toggleTheme } = useLandingTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="legal-nav-wrap">
      <nav className="legal-nav" aria-label="Legal page navigation">
        <div className="legal-nav-brand-shell">
          <Link href="/" className="legal-nav-brand" aria-label="Huddle home" onClick={closeMenu}>
            <LandingWordmark />
          </Link>
        </div>

        <div className="legal-nav-main">
          <div className="legal-nav-links">
            {legalRoutes.map((route) => {
              const isCurrent = route.kind === kind;

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={isCurrent ? 'is-active' : undefined}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {route.label}
                </Link>
              );
            })}
          </div>
          <div className="legal-nav-actions">
            <button
              type="button"
              className="legal-theme-button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button
              type="button"
              className="legal-menu-button"
              aria-expanded={menuOpen}
              aria-controls="legal-mobile-menu"
              aria-label={menuOpen ? 'Close legal navigation' : 'Open legal navigation'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div id="legal-mobile-menu" className="legal-mobile-menu">
          {legalRoutes.map((route) => {
            const isCurrent = route.kind === kind;

            return (
              <Link
                key={route.href}
                href={route.href}
                className={isCurrent ? 'is-active' : undefined}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={closeMenu}
              >
                {route.label}
              </Link>
            );
          })}
          <div className="legal-mobile-menu-actions">
            <button type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} aria-pressed={theme === 'dark'} onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default function LegalNavigation(props: LegalNavigationProps) {
  return (
    <LandingThemeProvider>
      <LegalNavigationContents {...props} />
    </LandingThemeProvider>
  );
}
