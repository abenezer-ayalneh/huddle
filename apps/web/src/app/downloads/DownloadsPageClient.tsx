'use client';

import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import ControlAgentDownloads from '@/components/ControlAgentDownloads';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import { getNoCostControlAgentBeta } from '@/lib/controlAgentFreeBeta';
import { getWindowsControlAgentPublicBeta } from '@/lib/windowsControlAgentPublicBeta';
import type { ControlAgentRelease } from '@/lib/controlAgentReleaseShared';
import type { WindowsControlAgentRelease } from '@/lib/windowsControlAgentReleaseShared';

type DownloadsPageClientProps = {
  release: ControlAgentRelease | null;
  windowsRelease: WindowsControlAgentRelease | null;
  repositoryUrl: string;
  operatorContactUrl: string;
};

function DownloadsNavigation() {
  return (
    <header className="downloads-nav-wrap">
      <nav className="downloads-nav" aria-label="Downloads navigation">
        <HuddleBrandThemeHeader
          homeHref="/"
          trailing={
            <Link href="/" className="downloads-back-link" aria-label="Back to Huddle">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Back to Huddle</span>
            </Link>
          }
        />
      </nav>
    </header>
  );
}

export default function DownloadsPageClient({ release, windowsRelease, repositoryUrl, operatorContactUrl }: DownloadsPageClientProps) {
  const hasVerifiedSignedRelease = release?.verified === true;
  const hasVerifiedWindowsRelease = windowsRelease?.verified === true;
  const hasNoCostBeta = !hasVerifiedSignedRelease && getNoCostControlAgentBeta(repositoryUrl) !== null;
  const hasWindowsPublicBeta = !hasVerifiedWindowsRelease && getWindowsControlAgentPublicBeta(repositoryUrl) !== null;
  const hasAnyRelease = hasVerifiedSignedRelease || hasVerifiedWindowsRelease || hasNoCostBeta || hasWindowsPublicBeta;

  return (
    <LandingThemeProvider>
      <main className="downloads-shell" id="top">
        <DownloadsNavigation />

        <section className="downloads-hero" aria-labelledby="downloads-title">
          <div className="downloads-signal-routes" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="downloads-container downloads-hero-grid">
            <div className="downloads-hero-copy">
              <p className="downloads-kicker">
                <span className="downloads-kicker-signal" aria-hidden="true" />
                Remote Control <span aria-hidden="true">/</span> Public beta
              </p>
              <h1 id="downloads-title">Give the Sharer a safe local switch.</h1>
              <p className="downloads-lede">
                {hasVerifiedSignedRelease || hasVerifiedWindowsRelease
                  ? 'The Control Agent is an attended companion for the Sharer’s macOS or Windows desktop. It shares one entire selected physical display only after approval in the active room and a local Start confirmation.'
                  : hasAnyRelease
                    ? 'Choose the installer that matches the Sharer’s desktop. It shares one entire selected physical display only after approval in the active room and a local Start confirmation.'
                    : 'This deployment has not configured a Control Agent release. Remote Control downloads are unavailable until the operator completes the release setup.'}
              </p>
              <div className="downloads-boundary-line">
                <ShieldCheck className="size-5" aria-hidden="true" />
                <p>
                  <strong>No unattended access.</strong> The Controller stays in the browser on every supported platform.
                </p>
              </div>
              <dl className="downloads-boundaries">
                <div>
                  <dt>Who installs</dt>
                  <dd>The Sharer only</dd>
                </div>
                <div>
                  <dt>Where it works</dt>
                  <dd>Inside an active Huddle room</dd>
                </div>
                <div>
                  <dt>What stays local</dt>
                  <dd>Permission and display choice</dd>
                </div>
              </dl>
            </div>

            <ControlAgentDownloads release={release} windowsRelease={windowsRelease} repositoryUrl={repositoryUrl} />
          </div>
        </section>

        <footer className="downloads-footer">
          <nav className="downloads-container" aria-label="Downloads footer navigation">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <a href={operatorContactUrl}>Contact</a>
          </nav>
        </footer>
      </main>
    </LandingThemeProvider>
  );
}
