'use client';

import { Menu, Moon, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import LandingThemeProvider, { useLandingTheme } from '@/components/landing/LandingThemeProvider';
import { LandingWordmark } from '@/components/landing/LandingProductScene';
import { publicConfig } from '@/lib/public-config';

type LegalNavigationProps = {
  kind: 'privacy' | 'terms';
};

const legalRoutes = [
  { href: '/privacy', label: 'Privacy', kind: 'privacy' },
  { href: '/terms', label: 'Terms', kind: 'terms' },
] as const;

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-1.02-.014-1.85-2.782.604-3.369-1.183-3.369-1.183-.455-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-.087.636-1.338-2.22-.253-4.555-1.11-4.943-4.943 0-1.091.39-1.984 1.03-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.337-.012 2.415-.012 2.742 0 .267.18.579.688.481A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

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
            <a
              href={publicConfig.projectRepositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="legal-nav-github"
              aria-label="Huddle repository"
              title="Huddle repository"
            >
              <GithubLogo className="size-5" />
            </a>
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
            <a href={publicConfig.projectRepositoryUrl} target="_blank" rel="noreferrer" aria-label="Huddle repository" title="Huddle repository">
              <GithubLogo className="size-5" />
            </a>
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
