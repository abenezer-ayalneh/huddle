'use client';

import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import ControlAgentDownloads from '@/components/ControlAgentDownloads';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import { getNoCostControlAgentBeta } from '@/lib/controlAgentFreeBeta';
import type { ControlAgentRelease } from '@/lib/controlAgentReleaseShared';

type DownloadsPageClientProps = {
  release: ControlAgentRelease | null;
  repositoryUrl: string;
  operatorContactUrl: string;
  releaseNotesFallbackUrl: string | null;
  issuesUrl: string | null;
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

export default function DownloadsPageClient({ release, repositoryUrl, operatorContactUrl, releaseNotesFallbackUrl, issuesUrl }: DownloadsPageClientProps) {
  const hasVerifiedSignedRelease = release?.verified === true;
  const hasNoCostBeta = !hasVerifiedSignedRelease && getNoCostControlAgentBeta(repositoryUrl) !== null;

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
                {hasVerifiedSignedRelease
                  ? 'The Control Agent is a signed, notarized macOS companion. It shares one entire selected physical display — including the menu bar, Dock, desktop, all windows, and the agent — only after the Sharer approves Remote Control in the room and confirms locally.'
                  : hasNoCostBeta
                    ? 'The Apple Silicon Control Agent beta is available now. It is ad-hoc signed and unnotarized: verify its published checksum, then use macOS Privacy & Security → Open Anyway. A signed, notarized two-architecture channel is still being prepared.'
                    : 'This deployment has not configured a verified Control Agent release. Remote Control downloads are unavailable until the operator completes that signed-release setup.'}
              </p>
              <div className="downloads-boundary-line">
                <ShieldCheck className="size-5" aria-hidden="true" />
                <p>
                  <strong>No unattended access.</strong> Windows and Linux agents are coming soon.
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

            <ControlAgentDownloads release={release} repositoryUrl={repositoryUrl} />
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
                {hasVerifiedSignedRelease
                  ? 'Every signed beta artifact is published with a SHA-256 checksum and a signed release manifest. The agent checks for required updates before redeeming a new session; it never installs updates silently.'
                  : hasNoCostBeta
                    ? 'This public Apple Silicon beta is a deliberate, limited fallback. Its DMG has a published SHA-256 checksum, but it is not Developer ID-signed, notarized, or substituted into the trusted release channel.'
                    : 'Downloads are intentionally disabled rather than falling back to an unsigned or unrelated artifact.'}
              </p>
              {releaseNotesFallbackUrl || issuesUrl ? (
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
