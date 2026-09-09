'use client';

import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import ControlAgentDownloads from '@/components/ControlAgentDownloads';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import { getNoCostControlAgentBeta } from '@/lib/controlAgentFreeBeta';
import type { ControlAgentRelease } from '@/lib/controlAgentReleaseShared';
import type { WindowsControlAgentRelease } from '@/lib/windowsControlAgentReleaseShared';

type DownloadsPageClientProps = {
  release: ControlAgentRelease | null;
  windowsRelease: WindowsControlAgentRelease | null;
  repositoryUrl: string;
  operatorContactUrl: string;
  releaseNotesFallbackUrl: string | null;
  issuesUrl: string | null;
  windowsReleaseNotesFallbackUrl: string | null;
  windowsIssuesUrl: string | null;
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

export default function DownloadsPageClient({
  release,
  windowsRelease,
  repositoryUrl,
  operatorContactUrl,
  releaseNotesFallbackUrl,
  issuesUrl,
  windowsReleaseNotesFallbackUrl,
  windowsIssuesUrl,
}: DownloadsPageClientProps) {
  const hasVerifiedSignedRelease = release?.verified === true;
  const hasVerifiedWindowsRelease = windowsRelease?.verified === true;
  const hasNoCostBeta = !hasVerifiedSignedRelease && getNoCostControlAgentBeta(repositoryUrl) !== null;
  const hasAnyRelease = hasVerifiedSignedRelease || hasVerifiedWindowsRelease || hasNoCostBeta;

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
                    ? 'The public beta is available for the listed desktop platforms. Verify its published checksum before installing. An unsigned Windows installer has no publisher trust; a macOS ad-hoc build is not notarized.'
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

        <section className="downloads-integrity" aria-labelledby="downloads-integrity-title">
          <div className="downloads-container downloads-integrity-frame">
            <div className="downloads-integrity-heading">
              <p className="downloads-kicker">Release integrity</p>
              <h2 id="downloads-integrity-title">A download is part of the handoff.</h2>
            </div>
            <div className="downloads-integrity-content">
              <p>
                {hasVerifiedSignedRelease || hasVerifiedWindowsRelease
                  ? 'Every verified beta release publishes a SHA-256 checksum and a platform-specific signed release manifest. The agent checks for required updates before redeeming a new session; it never installs updates silently.'
                  : hasAnyRelease
                    ? 'Each public beta has a SHA-256 checksum. That checksum verifies downloaded bytes; it does not turn an unsigned Windows installer or an unnotarized macOS app into a publisher-trusted release.'
                    : 'Downloads are intentionally disabled rather than falling back to an unsigned or unrelated artifact.'}
              </p>
              {releaseNotesFallbackUrl || issuesUrl || windowsReleaseNotesFallbackUrl || windowsIssuesUrl ? (
                <div className="downloads-integrity-links">
                  {releaseNotesFallbackUrl ? (
                    <a href={release?.releaseNotesUrl ?? releaseNotesFallbackUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" /> Release notes
                    </a>
                  ) : null}
                  {issuesUrl ? (
                    <a href={issuesUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" /> Report a beta problem
                    </a>
                  ) : null}
                  {windowsReleaseNotesFallbackUrl ? (
                    <a href={windowsRelease?.releaseNotesUrl ?? windowsReleaseNotesFallbackUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" /> Windows release notes
                    </a>
                  ) : null}
                  {windowsIssuesUrl ? (
                    <a href={windowsIssuesUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" /> Report a Windows beta problem
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
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
