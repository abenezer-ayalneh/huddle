import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';
import ControlAgentDownloads from '@/components/ControlAgentDownloads';
import { getControlAgentRelease } from '@/lib/controlAgentRelease';
import { CONTROL_AGENT_RELEASE } from '@/lib/controlAgentReleaseShared';
import { publicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: 'Control Agent downloads',
  description: 'Download the Huddle Control Agent public beta for attended macOS Remote Control.',
  alternates: { canonical: '/downloads' },
};

export const revalidate = 3600;

export default async function DownloadsPage() {
  const release = await getControlAgentRelease();
  const hasVerifiedSignedRelease = release?.verified === true;
  return (
    <main className="min-h-screen bg-background text-white">
      <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="Downloads navigation">
        <Link href="/" className="flex items-center gap-3" aria-label="Huddle home">
          <HuddleIcon className="size-9" />
          <span className="font-display text-xl font-bold">Huddle</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white">
          <ArrowLeft className="size-4" /> Back to Huddle
        </Link>
      </nav>
      <header className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.24em] text-cyan">Remote Control · Public beta</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.96] tracking-normal sm:text-7xl">Give the Sharer a safe local switch.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
          {hasVerifiedSignedRelease
            ? 'The Control Agent is a signed, notarized macOS companion. It shares one entire selected physical display — including the menu bar, Dock, desktop, all windows, and the agent — only after the Sharer approves Remote Control in the room and confirms locally.'
            : 'This deployment has not configured a verified Control Agent release. Remote Control downloads are unavailable until the operator completes that signed-release setup.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/55">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1.5 text-cyan">
            <ShieldCheck className="size-4" /> No unattended access
          </span>
          <span>Windows and Linux agents are coming soon.</span>
        </div>
      </header>
      <ControlAgentDownloads release={release} />
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Release integrity and help</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
            {hasVerifiedSignedRelease
              ? 'Every signed beta artifact is published with a SHA-256 checksum and a signed release manifest. The agent checks for required updates before redeeming a new session; it never installs updates silently.'
              : 'Downloads are intentionally disabled rather than falling back to an unsigned or unrelated artifact.'}
          </p>
          {CONTROL_AGENT_RELEASE ? <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <a
              href={release?.releaseNotesUrl ?? CONTROL_AGENT_RELEASE.releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-cyan hover:text-white"
            >
              <ExternalLink className="size-4" /> Release notes
            </a>
            <a href={CONTROL_AGENT_RELEASE.issuesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan hover:text-white">
              <ExternalLink className="size-4" /> Report a beta problem
            </a>
          </div> : null}
        </div>
      </section>
      <footer className="border-t border-white/10 px-5 py-8 text-sm text-white/45 sm:px-8">
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2" aria-label="Downloads footer navigation">
          <Link href="/privacy" className="transition-colors hover:text-cyan">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-cyan">
            Terms of Service
          </Link>
          <a href={publicConfig.operatorContactUrl} className="transition-colors hover:text-cyan">
            Contact
          </a>
        </nav>
      </footer>
    </main>
  );
}
