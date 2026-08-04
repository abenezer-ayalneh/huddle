import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';
import LegalTableOfContents from '@/components/legal/LegalTableOfContents';

export type LegalTocItem = {
  id: string;
  label: string;
};

type LegalPageProps = {
  kind: 'privacy' | 'terms';
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  toc: LegalTocItem[];
  children: ReactNode;
};

export default function LegalPage({ kind, eyebrow, title, description, updatedAt, toc, children }: LegalPageProps) {
  const Icon = kind === 'privacy' ? ShieldCheck : Scale;

  return (
    <main className="relative min-h-screen bg-background text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-48 top-24 size-[34rem] rounded-full bg-magenta/[0.09] blur-[150px]" />
        <div className="absolute -right-48 top-[32rem] size-[32rem] rounded-full bg-cyan/[0.08] blur-[150px]" />
      </div>

      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="Legal page navigation">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Huddle home">
          <HuddleIcon className="size-9 shrink-0" />
          <span className="font-display text-xl font-bold">Huddle</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="size-4" />
          Back to Huddle
        </Link>
      </nav>

      <header className="border-y border-white/10 bg-white/[0.018]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex size-12 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]">
            <Icon className="size-6" strokeWidth={1.7} />
          </div>
          <p className="mt-7 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-bold leading-[0.96] tracking-normal sm:text-6xl lg:text-7xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65 sm:text-xl">{description}</p>
          <p className="mt-6 text-sm text-white/45">Last updated {updatedAt}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
        <LegalTableOfContents title={title} toc={toc} />

        <article className="min-w-0 max-w-4xl">{children}</article>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <HuddleIcon className="size-7" />
            <span>Huddle · Self-hosted meetings with visible authority.</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal links">
            <Link href="/privacy" className="transition-colors hover:text-cyan">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-cyan">
              Terms of Service
            </Link>
            <a href="https://abenezer-ayalneh.dev/contact" className="transition-colors hover:text-cyan">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-10 border-t border-white/10 py-11 first:border-t-0 first:pt-0">
      <h2 className="font-display text-3xl font-semibold tracking-normal text-white sm:text-4xl">{title}</h2>
      <div className="mt-6 space-y-5 text-[1.04rem] leading-8 text-white/[0.68] [&_a]:text-cyan [&_a]:underline [&_a]:decoration-cyan/30 [&_a]:underline-offset-4 hover:[&_a]:text-white [&_h3]:pt-3 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white [&_li]:pl-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-3 [&_strong]:font-semibold [&_strong]:text-white/90 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:marker:text-cyan/60">
        {children}
      </div>
    </section>
  );
}

export function LegalCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan/20 bg-cyan/[0.065] p-5 shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] sm:p-6">
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <div className="mt-2 text-base leading-7 text-white/65">{children}</div>
    </div>
  );
}
