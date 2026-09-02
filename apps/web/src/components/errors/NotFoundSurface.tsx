'use client';

import Link from 'next/link';
import HuddleIcon from '@/components/HuddleIcon';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';

// A missing route is a normal navigation outcome, not a render fault. Keep it
// distinct from ErrorSurface so the recovery path stays about wayfinding.
export default function NotFoundSurface() {
  return (
    <LandingThemeProvider>
      <main className="signal-not-found-shell">
        <header className="signal-not-found-header">
          <div className="signal-not-found-container">
            <HuddleBrandThemeHeader homeHref="/" />
          </div>
        </header>

        <div className="signal-not-found-route signal-not-found-route--top" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="signal-not-found-route signal-not-found-route--bottom" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="signal-not-found-container signal-not-found-layout">
          <section className="signal-not-found-intro" aria-labelledby="not-found-title">
            <p className="signal-not-found-kicker">Signal Handoff / 404</p>
            <h1 id="not-found-title">This route missed the handoff.</h1>
            <p className="signal-not-found-lede">
              The page you requested is not part of this Huddle. The link may be old, incomplete, or meant for a different room.
            </p>
            <div className="signal-not-found-divider" aria-hidden="true" />
          </section>

          <section className="signal-not-found-panel" aria-labelledby="not-found-panel-title">
            <div className="signal-not-found-panel-heading">
              <p id="not-found-panel-title">Route signal</p>
              <span aria-hidden="true" />
            </div>

            <div className="signal-not-found-mark" aria-hidden="true">
              <HuddleIcon />
            </div>
            <p className="signal-not-found-status">Route not found</p>
            <p className="signal-not-found-copy">Nothing was opened here. Start from a known Huddle surface.</p>

            <div className="signal-not-found-state">
              <span>Signal state</span>
              <code>NO ROUTE</code>
            </div>

            <div className="signal-not-found-actions">
              <Link href="/" className="signal-not-found-primary">
                Back to Huddle
              </Link>
              <Link href="/lobby" className="signal-not-found-secondary">
                Open lobby
              </Link>
            </div>
          </section>
        </div>
      </main>
    </LandingThemeProvider>
  );
}
