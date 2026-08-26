'use client';

import { Apple, CheckCircle2, Cpu, Download, Monitor, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
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

export default function ControlAgentDownloads({ release }: { release: ControlAgentRelease | null }) {
  const [detected, setDetected] = useState<{ platform: DetectedPlatform; architecture: DetectedArchitecture }>({ platform: 'other', architecture: 'unknown' });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDetected(detectPlatform()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const download = (architecture: 'arm64' | 'x86_64'): DownloadArtifact | undefined => {
    return release?.verified ? release.downloads[architecture] : undefined;
  };
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
            {release?.verified ? 'Verified release' : 'Release unavailable'}
          </span>
        </div>

        <div className="downloads-architecture-list">
          {(['arm64', 'x86_64'] as const).map((architecture) => {
            const artifact = download(architecture);
            const isRecommended = macDetected && detected.architecture === architecture;
            const label = architecture === 'arm64' ? 'Apple Silicon' : 'Intel';

            return (
              <article key={architecture} className={`downloads-architecture${isRecommended ? ' is-recommended' : ''}`}>
                <div className="downloads-architecture__identity">
                  <span className="downloads-architecture__icon" aria-hidden="true">
                    <Apple className="size-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="downloads-architecture__title-row">
                      <h3>macOS · {label}</h3>
                      {isRecommended ? <span className="downloads-recommended">Recommended</span> : null}
                    </div>
                    <p>macOS 13 or later · {architecture === 'arm64' ? 'M1, M2, M3, M4' : 'Intel Macs'}</p>
                  </div>
                </div>
                <div className="downloads-architecture__meta">
                  <span>
                    <Cpu className="size-3.5" aria-hidden="true" /> {artifact ? release?.version : 'Signed release unavailable'}
                  </span>
                  {artifact?.sizeBytes ? <span>{formatBytes(artifact.sizeBytes)} · SHA-256 published</span> : null}
                </div>
                {artifact ? (
                  <a href={artifact.url} className="downloads-download-button">
                    <Download className="size-4" aria-hidden="true" /> Download {label} DMG
                  </a>
                ) : (
                  <p className="downloads-unavailable">This operator has not configured a verified Control Agent release.</p>
                )}
              </article>
            );
          })}
        </div>

        <div className="downloads-station-foot">
          <p className="downloads-detection">
            {architectureLabel
              ? `Your browser reports ${architectureLabel}.`
              : 'If your Mac architecture is unknown, choose the matching DMG from About This Mac.'}{' '}
            Downloads are never selected silently.
          </p>
          {!release?.verified ? <p className="downloads-release-warning">Downloads stay unavailable until this deployment provides a signed release manifest and matching public key.</p> : null}
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
