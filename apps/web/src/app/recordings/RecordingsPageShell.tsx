'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';

type RecordingsPageShellProps = {
  children: ReactNode;
};

export function RecordingsPageShell({ children }: RecordingsPageShellProps) {
  return (
    <LandingThemeProvider>
      <main className="recordings-shell">
        <header className="recordings-header">
          <div className="recordings-header__inner">
            <HuddleBrandThemeHeader
              homeHref="/"
              trailing={
                <Link href="/lobby" className="recordings-header__back">
                  Back to lobby
                </Link>
              }
            />
          </div>
        </header>
        <div className="recordings-route recordings-route--one" aria-hidden="true" />
        <div className="recordings-route recordings-route--two" aria-hidden="true" />
        {children}
      </main>
    </LandingThemeProvider>
  );
}

export function RecordingsLoadingState({ label = 'Loading private archive' }: { label?: string }) {
  return (
    <section className="recordings-content" aria-busy="true" aria-live="polite">
      <div className="recordings-masthead">
        <div>
          <p className="recordings-kicker">HOST RECORDING ARCHIVE</p>
          <h1>Recordings, kept within reach.</h1>
          <p className="recordings-intro">Your hosted sessions and their delivery state are loading.</p>
        </div>
        <div className="recordings-state-rail">
          <span className="recordings-state-rail__dot" />
          <p>Private archive</p>
          <span>Host access only</span>
        </div>
      </div>

      <div className="recordings-loading-workspace">
        <div className="recordings-loading-panel">
          <LoadingSpinner className="recordings-loading-mark" />
          <p role="status">{label}</p>
          <span className="recordings-loading-line recordings-loading-line--wide" />
          <span className="recordings-loading-line" />
        </div>
        <div className="recordings-loading-ledger" aria-hidden="true">
          <span className="recordings-loading-line recordings-loading-line--short" />
          <span className="recordings-loading-row" />
          <span className="recordings-loading-row" />
          <span className="recordings-loading-row" />
        </div>
      </div>
    </section>
  );
}
