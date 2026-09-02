'use client';

import { Apple, CheckCircle2, Cpu, Download, ExternalLink, Monitor, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNoCostControlAgentBeta } from '@/lib/controlAgentFreeBeta';
import type { ControlAgentRelease } from '@/lib/controlAgentReleaseShared';
import { formatBytes } from '@/lib/controlAgentReleaseShared';

type DetectedPlatform = 'mac' | 'windows' | 'linux' | 'other';
type DetectedArchitecture = 'arm64' | 'x86_64' | 'unknown';
type DownloadArtifact = { url: string; sizeBytes?: number };

function detectPlatform(): { platform: DetectedPlatform; architecture: DetectedArchitecture } {
  if (typeof navigator === 'undefined') return { platform: 'other', architecture: 'unknown' };
  const userAgent = navigator.userAgent.toLowerCase();
  const platformText = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() ?? '';
  const platform =
    /mac/.test(userAgent) || platformText.includes('mac')
      ? 'mac'
      : /win/.test(userAgent) || platformText.includes('win')
        ? 'windows'
        : /linux/.test(userAgent) || platformText.includes('linux')
          ? 'linux'
          : 'other';
  const architectureText = (navigator as Navigator & { userAgentData?: { architecture?: string } }).userAgentData?.architecture?.toLowerCase() ?? '';
  const architecture: DetectedArchitecture =
    architectureText.includes('arm') || architectureText.includes('aarch')
      ? 'arm64'
      : architectureText.includes('86') || architectureText.includes('x64')
        ? 'x86_64'
        : 'unknown';
  return { platform, architecture };
}

export default function ControlAgentDownloads({ release, repositoryUrl }: { release: ControlAgentRelease | null; repositoryUrl: string }) {
  const [detected, setDetected] = useState<{ platform: DetectedPlatform; architecture: DetectedArchitecture }>({ platform: 'other', architecture: 'unknown' });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDetected(detectPlatform()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const download: DownloadArtifact | undefined = release?.verified ? release.downloads.arm64 : undefined;
  const noCostBeta = release?.verified ? null : getNoCostControlAgentBeta(repositoryUrl);
  const macDetected = detected.platform === 'mac';
  const architectureLabel = detected.architecture === 'arm64' ? 'Apple Silicon' : detected.architecture === 'x86_64' ? 'Intel' : null;

  return (
    <div className="downloads-agent">
      <section className="downloads-release-station" id="downloads" aria-labelledby="downloads-station-title">
        <div className="downloads-release-station__header">
          <div>
            <p className="downloads-station-label">macOS companion</p>
            <h2 id="downloads-station-title">Choose the build for this Mac.</h2>
          </div>
          <span className={release?.verified ? 'downloads-release-status is-verified' : 'downloads-release-status'}>
            {release?.verified ? 'Verified release' : noCostBeta ? 'Public arm64 beta' : 'Release unavailable'}
          </span>
        </div>

        <div className="downloads-architecture-list">
          {(() => {
            const artifact = download ?? (noCostBeta ? { url: noCostBeta.downloadUrl } : undefined);
            const isRecommended = macDetected && detected.architecture === 'arm64';

            return (
              <article className={`downloads-architecture${isRecommended ? ' is-recommended' : ''}`}>
                <div className="downloads-architecture__identity">
                  <span className="downloads-architecture__icon" aria-hidden="true">
                    <Apple className="size-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="downloads-architecture__title-row">
                      <h3>macOS · Apple Silicon</h3>
                      {isRecommended ? <span className="downloads-recommended">Recommended</span> : null}
                    </div>
                    <p>macOS 13 or later · M1, M2, M3, M4</p>
                  </div>
                </div>
                <div className="downloads-architecture__meta">
                  <span>
                    <Cpu className="size-3.5" aria-hidden="true" /> {release?.verified ? release.version : noCostBeta ? 'No-cost public beta' : 'Release details unavailable'}
                  </span>
                  {artifact?.sizeBytes ? <span>{formatBytes(artifact.sizeBytes)} · SHA-256 published</span> : null}
                </div>
                {artifact ? (
                  <a href={artifact.url} className="downloads-download-button">
                    <Download className="size-4" aria-hidden="true" /> Download Apple Silicon DMG
                  </a>
                ) : (
                  <p className="downloads-unavailable">This operator has not configured a verified Control Agent release.</p>
                )}
                {noCostBeta ? (
                  <p className="downloads-unavailable">
                    Ad-hoc signed and unnotarized. Verify the{' '}
                    <a href={noCostBeta.checksumUrl} target="_blank" rel="noreferrer">
                      SHA-256 checksum <ExternalLink className="inline size-3" aria-hidden="true" />
                    </a>
                    , then use macOS Privacy &amp; Security → Open Anyway.
                  </p>
                ) : null}
              </article>
            );
          })()}
        </div>

        <div className="downloads-station-foot">
          <p className="downloads-detection">
            {architectureLabel
              ? `Your browser reports ${architectureLabel}.`
              : 'If your Mac architecture is unknown, choose the matching DMG from About This Mac.'}{' '}
            Downloads are never selected silently.
          </p>
          {!release?.verified ? (
            <p className="downloads-release-warning">
              {noCostBeta
                ? 'The Apple Silicon beta is available. A verified multi-architecture release channel will be added when available.'
                : 'A verified Control Agent release can be added to this deployment when it is ready.'}
            </p>
          ) : null}
        </div>
      </section>

      <section className="downloads-handoff-guide" aria-labelledby="downloads-guide-title">
        <div className="downloads-guide-heading">
          <p className="downloads-kicker">Your first handoff</p>
          <h2 id="downloads-guide-title">Prepare once. Keep control in the room.</h2>
        </div>
        <ol className="downloads-guide-list">
          <li>
            <CheckCircle2 className="size-5" aria-hidden="true" />
            <div>
              <strong>Install deliberately</strong>
              <p>{release?.verified ? 'Open the signed DMG, drag Huddle Control Agent to Applications, then launch it.' : 'When a verified release is configured, open its DMG, drag Huddle Control Agent to Applications, then launch it.'}</p>
            </div>
          </li>
          <li>
            <ShieldCheck className="size-5" aria-hidden="true" />
            <div>
              <strong>Prepare explicitly</strong>
              <p>Press Prepare for Remote Control and grant Screen Recording plus Accessibility when macOS asks.</p>
            </div>
          </li>
          <li>
            <Monitor className="size-5" aria-hidden="true" />
            <div>
              <strong>Share while attended</strong>
              <p>Only the Sharer installs the agent. The Controller stays in the browser, and every session remains attended.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
