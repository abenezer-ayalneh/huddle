import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Download, KeyRound, LockKeyhole, RadioTower, Server, ShieldCheck, Video } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';
import LandingJoinForm from './LandingJoinForm';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Huddle',
    applicationCategory: 'CommunicationApplication',
    applicationSubCategory: 'Video conferencing',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Huddle is a self-hosted, browser-based video conferencing app built on LiveKit. Hosts create or schedule meetings; guests join from a shared link through a waiting room, with no account or install.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Self-hosted on your own infrastructure',
      'Real-time video and audio using the LiveKit WebRTC SFU',
      'Screen sharing',
      'In-call chat',
      'Knock-to-join waiting room',
      'Host controls for mute, remove, and admit',
      'Instant or scheduled meetings',
      'Shareable meeting links for account-free guests',
      'Room recording with downloadable artifacts',
    ],
    author: { '@type': 'Person', name: 'Abenezer Ayalneh', url: 'https://abenezer-ayalneh.dev' },
    publisher: { '@type': 'Person', name: 'Abenezer Ayalneh', url: 'https://abenezer-ayalneh.dev' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Huddle',
    url: siteUrl,
    inLanguage: 'en',
    publisher: { '@type': 'Person', name: 'Abenezer Ayalneh', url: 'https://abenezer-ayalneh.dev' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Do guests need an account to join a Huddle meeting?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Guests open the shared meeting link, pick a display name, and knock to enter the waiting room. Only hosts who create or schedule meetings need an account.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Huddle self-hosted?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Huddle runs on a self-hosted LiveKit WebRTC server with Redis, Postgres, and MinIO for storage. The stack ships as a Docker Compose deployment for a single VPS.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Huddle record meetings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Hosts can toggle room-composite recording in-call. Recordings are written by LiveKit Egress to MinIO and downloaded through the host-authorized API.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does Huddle cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The official Huddle service currently has no subscription fee. A self-hosted operator remains responsible for its own infrastructure and provider costs.',
        },
      },
    ],
  },
];

const controlFeatures = [
  {
    title: 'Gate guests before the room',
    copy: 'Shared links can stay simple while the host decides who crosses the threshold.',
    icon: LockKeyhole,
    className: 'border-magenta/20 bg-magenta/10',
  },
  {
    title: 'Keep authority on the server',
    copy: 'JWT grants, mute actions, removal, and recording all pass through the API.',
    icon: ShieldCheck,
    className: 'border-white/10 bg-white/[0.045]',
  },
  {
    title: 'Record to your storage',
    copy: 'LiveKit Egress writes room-composite files to MinIO, then Huddle brokers the download.',
    icon: Download,
    className: 'border-cyan/20 bg-cyan/10',
  },
];

const stack = [
  ['Browser', 'Next.js handles the lobby, pre-join checks, call controls, guest knock, and recordings.'],
  ['API', 'NestJS mints tokens, owns room authority, validates host actions, and receives webhooks.'],
  ['LiveKit', 'The SFU carries audio, video, screen share, chat, TURN, and room-composite egress.'],
  ['Storage', 'Postgres keeps rooms, Redis coordinates state, and MinIO stores recording artifacts.'],
];

export default function LandingPage() {
  return (
    <main className="flex-1 overflow-hidden bg-background text-white">
      <section className="relative min-h-[88dvh] overflow-hidden border-b border-white/10 sm:min-h-[92dvh]">
        <Image
          src="/landing-orbit.png"
          alt="Abstract magenta and cyan WebRTC topology for Huddle meetings"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[63%_48%] opacity-95"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.09_0.018_275/0.96)_0%,oklch(0.11_0.02_280/0.9)_38%,oklch(0.12_0.02_285/0.42)_70%,oklch(0.12_0.02_285/0.16)_100%)]" />
        <div className="landing-breathe absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,oklch(0.66_0.27_350/0.2),transparent_28%),radial-gradient(circle_at_72%_70%,oklch(0.82_0.15_200/0.11),transparent_34%)]" />

        <nav className="relative mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="Main navigation">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Huddle home">
            <HuddleIcon className="size-9 shrink-0" />
            <span className="font-display text-xl font-bold text-white">Huddle</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="#control" className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white md:inline-flex">
              Control
            </Link>
            <Link href="#stack" className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white md:inline-flex">
              Stack
            </Link>
            <Link href="/downloads" className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white md:inline-flex">
              Downloads
            </Link>
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-cyan/25 bg-white/[0.08] px-3.5 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.09)] transition-colors hover:bg-white/[0.13] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70"
            >
              <Video className="size-4" strokeWidth={1.8} />
              Open lobby
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto flex min-h-[calc(88dvh-4.5rem)] max-w-7xl items-center px-5 pb-12 pt-6 sm:min-h-[calc(92dvh-4.5rem)] sm:px-8 lg:pb-16">
          <div className="landing-rise max-w-3xl">
            <h1 className="max-w-[11ch] font-display text-5xl font-bold leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Own the room. Run the call.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-white/75 sm:text-xl sm:leading-8">
              Self-hosted browser meetings with waiting rooms, recordings, and host authority built on LiveKit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/lobby"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-magenta px-5 py-3 font-display font-semibold text-background shadow-[0_16px_45px_oklch(0.66_0.27_350/0.28)] transition-all hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Open lobby
                <ArrowRight className="size-5" strokeWidth={1.8} />
              </Link>
              <Link
                href="#join"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-cyan/30 bg-white/[0.08] px-5 py-3 font-semibold text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] transition-colors hover:bg-white/[0.13] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70"
              >
                Join room
                <ArrowRight className="size-5" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="join" className="border-b border-white/10 bg-background/[0.92] px-5 py-9 backdrop-blur sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,0.7fr)] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-normal text-white sm:text-4xl">Enter the meeting signal.</h2>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-white/[0.64]">
              Paste a room code or shared link. Guests knock first, then the host admits them.
            </p>
          </div>
          <LandingJoinForm />
        </div>
      </section>

      <section id="control" className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-display text-4xl font-bold tracking-normal text-white sm:text-5xl">The host gets the switchboard.</h2>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-white/[0.64]">Guests get one link. Hosts get entry, media, recording, and room authority.</p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045]">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src="/landing-control.png"
                  alt="Abstract magenta and cyan host control modules for Huddle"
                  fill
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,oklch(0.1_0.018_275/0.92)_0%,transparent_46%)]" />
              </div>
              <div className="p-6 sm:p-7">
                <KeyRound className="size-7 text-magenta" strokeWidth={1.8} />
                <h3 className="mt-5 font-display text-3xl font-semibold tracking-normal text-white">Control is a product surface.</h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/[0.62]">
                  Huddle treats meeting authority as visible software: guests wait, hosts decide, and secrets stay server-side.
                </p>
              </div>
            </article>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
              {controlFeatures.map((feature) => (
                <article
                  key={feature.title}
                  className={`flex min-h-[210px] flex-col justify-between rounded-lg border p-6 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)] lg:min-h-0 ${feature.className}`}
                >
                  <feature.icon className="size-6 text-cyan" strokeWidth={1.8} />
                  <div className="pt-8">
                    <h3 className="font-display text-2xl font-semibold tracking-normal text-white">{feature.title}</h3>
                    <p className="mt-3 text-base leading-7 text-white/[0.62]">{feature.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="border-y border-white/10 bg-white/[0.025] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-display text-4xl font-bold tracking-normal text-white sm:text-5xl">Trust boundaries you can inspect.</h2>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-white/[0.64]">
              Browser media, server authority, LiveKit routing, and storage each stay in their lane.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.76fr_1fr] lg:items-stretch">
            <div className="rounded-lg border border-cyan/[0.16] bg-background/[0.62] p-6 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]">
              <Server className="size-7 text-cyan" strokeWidth={1.8} />
              <p className="mt-8 break-words font-mono text-sm leading-6 text-white/[0.68]">docker compose -f infra/docker-compose.yml up -d</p>
              <p className="mt-5 text-base leading-7 text-white/60">
                Local development runs the same shape as deployment: web, API, LiveKit, Redis, Postgres, and MinIO.
              </p>
            </div>

            <ol className="grid gap-3 sm:grid-cols-2">
              {stack.map(([term, description]) => (
                <li key={term} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-xl font-semibold text-white">{term}</h3>
                    <RadioTower className="size-5 shrink-0 text-magenta" strokeWidth={1.8} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/60">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl border-t border-white/[0.12] pt-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,0.82fr)_auto] lg:items-center">
            <div className="max-w-2xl">
              <ShieldCheck className="mb-6 size-7 text-magenta" strokeWidth={1.8} />
              <h2 className="font-display text-4xl font-bold tracking-normal text-white sm:text-5xl">Make the next room yours.</h2>
              <p className="mt-4 text-lg leading-7 text-white/[0.64]">
                Open the lobby, create a room, and send a link that still respects your infrastructure.
              </p>
            </div>
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-magenta px-5 py-3 font-display font-semibold text-background shadow-[0_16px_45px_oklch(0.66_0.27_350/0.24)] transition-all hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Open lobby
              <ArrowRight className="size-5" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-white/[0.018] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3 transition-colors hover:text-white" aria-label="Huddle home">
            <HuddleIcon className="size-7" />
            <span>Huddle · Operated by Abenezer Ayalneh</span>
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
            <Link href="/privacy" className="transition-colors hover:text-cyan">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-cyan">
              Terms of Service
            </Link>
            <Link href="/downloads" className="transition-colors hover:text-cyan">
              Downloads
            </Link>
            <a href="https://abenezer-ayalneh.dev/contact" className="transition-colors hover:text-cyan">
              Contact
            </a>
          </nav>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
