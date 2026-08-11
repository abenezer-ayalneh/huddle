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
    <>
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          {(['arm64', 'x86_64'] as const).map((architecture) => {
            const artifact = download(architecture);
            const isRecommended = macDetected && detected.architecture === architecture;
            const label = architecture === 'arm64' ? 'Apple Silicon' : 'Intel';
            return (
              <article
                key={architecture}
                className={`rounded-2xl border p-6 shadow-[inset_0_1px_0_oklch(1_0_0/0.07)] ${isRecommended ? 'border-cyan/60 bg-cyan/10' : 'border-white/10 bg-white/[0.045]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Apple className="size-7 text-cyan" strokeWidth={1.6} />
                    <div>
                      <h2 className="font-display text-2xl font-semibold text-white">macOS · {label}</h2>
                      <p className="mt-1 text-sm text-white/55">macOS 13 or later · {architecture === 'arm64' ? 'M1, M2, M3, M4' : 'Intel Macs'}</p>
                    </div>
                  </div>
                  {isRecommended ? (
                    <span className="rounded-full bg-cyan/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">Recommended</span>
                  ) : null}
                </div>
                <div className="mt-6 flex items-center justify-between gap-4 text-xs text-white/45">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="size-3.5" />{' '}
                    {artifact ? release?.version : 'Signed release unavailable'}
                  </span>
                  {artifact?.sizeBytes ? <span>{formatBytes(artifact.sizeBytes)} · SHA-256 published</span> : null}
                </div>
                {artifact ? (
                  <>
                    <a
                      href={artifact.url}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-magenta px-4 py-3 font-display font-semibold text-background transition hover:brightness-110"
                    >
                      <Download className="size-4" /> Download {label} DMG
                    </a>
                  </>
                ) : (
                  <p className="mt-5 rounded-lg bg-white/[0.06] px-4 py-3 text-center text-sm text-white/60">This operator has not configured a verified Control Agent release.</p>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-white/45">
          {architectureLabel
            ? `Your browser reports ${architectureLabel}.`
            : 'If your Mac architecture is unknown, choose the matching DMG from About This Mac.'}{' '}
          Downloads are never selected silently.
        </p>
        {!release?.verified ? (
          <p className="mt-2 text-center text-xs text-orange-200/75">
            Downloads stay unavailable until this deployment provides a signed release manifest and matching public key.
          </p>
        ) : null}
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-1 size-5 shrink-0 text-cyan" />
            <div>
              <h3 className="font-display text-lg font-semibold text-white">Install deliberately</h3>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Open the signed DMG, drag Huddle Control Agent to Applications, then launch it.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 size-5 shrink-0 text-cyan" />
            <div>
              <h3 className="font-display text-lg font-semibold text-white">Prepare explicitly</h3>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Press Prepare for Remote Control and grant Screen Recording plus Accessibility when macOS asks.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Monitor className="mt-1 size-5 shrink-0 text-cyan" />
            <div>
              <h3 className="font-display text-lg font-semibold text-white">Sharer only</h3>
              <p className="mt-1 text-sm leading-6 text-white/55">
                Only the Sharer installs the agent. The Controller stays in the browser, and every session remains attended.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
