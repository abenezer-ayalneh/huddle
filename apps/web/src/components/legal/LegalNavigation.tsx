'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';

type LegalNavigationProps = {
  kind: 'privacy' | 'terms';
};

const legalRoutes = [
  { href: '/privacy', label: 'Privacy', kind: 'privacy' },
  { href: '/terms', label: 'Terms', kind: 'terms' },
] as const;

function LegalNavigationContents({ kind }: LegalNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="legal-nav-wrap">
      <nav className="legal-nav" aria-label="Legal page navigation">
        <HuddleBrandThemeHeader
          homeHref="/"
          onHomeClick={closeMenu}
          navigation={
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
            </div>
          }
          trailing={
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
          }
        />
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
