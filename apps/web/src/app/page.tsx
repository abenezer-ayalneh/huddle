import Link from 'next/link';
import { ArrowRight, Download, LockKeyhole, RadioTower, Server, ShieldCheck, Sparkles, Video } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';
import LandingJoinForm from './LandingJoinForm';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

// JSON-LD payloads. Inlined in the lobby shell so search engines (Google rich
// results) and AI search crawlers (ChatGPT, Perplexity, Claude) can model the
// product as a SoftwareApplication and find the canonical site identity.
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
      'Huddle is a self-hosted, browser-based video conferencing app built on LiveKit. Hosts create or schedule meetings; guests join from a shared link through a waiting room — no account, no installs.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Self-hosted on your own infrastructure',
      'Real-time video and audio (LiveKit WebRTC SFU)',
      'Screen sharing',
      'In-call chat',
      'Knock-to-join waiting room',
      'Host controls (mute, remove, admit)',
      'Instant or scheduled meetings',
      'Shareable meeting links — guests join without an account',
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
          text: 'Yes. Huddle runs on a self-hosted LiveKit WebRTC server with Redis, Postgres, and MinIO for storage. The whole stack ships as a Docker Compose deployment for a single VPS.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Huddle record meetings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Hosts can toggle room-composite recording in-call. Recordings are written by LiveKit Egress to MinIO (S3-compatible) and downloadable through the host-authorized API.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does Huddle cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Huddle is free and open: you run it on your own server. There is no per-seat pricing or vendor subscription.',
        },
      },
    ],
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1 overflow-hidden">
      <section className="relative min-h-[86svh] overflow-hidden border-b border-white/10">
        <LandingScene />

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Huddle home">
            <HuddleIcon className="size-9 drop-shadow-[0_0_12px_rgba(217,70,168,0.45)]" />
            <span className="font-display text-xl font-bold text-white">Huddle</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="#features" className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex">
              Features
            </Link>
            <Link href="#stack" className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex">
              Stack
            </Link>
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
            >
              <Video className="size-4" />
              Open lobby
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(86svh-5rem)] max-w-7xl items-end px-5 pb-10 pt-16 sm:px-8 lg:pb-14">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan/25 bg-cyan/10 px-3 py-1.5 text-sm font-medium text-cyan">
              <RadioTower className="size-4" />
              LiveKit-powered, self-hosted calls
            </div>
            <h1 className="font-display text-6xl font-bold leading-none tracking-normal text-white sm:text-7xl lg:text-8xl">Huddle</h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-white/72 sm:text-2xl sm:leading-9">
              Browser meetings with host control, guest waiting rooms, screen sharing, chat, and recordings, packaged for your own server.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/lobby"
                className="neon-magenta inline-flex items-center justify-center gap-2 rounded-md bg-magenta px-5 py-3 font-display font-semibold text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
              >
                Host a meeting
                <ArrowRight className="size-5" />
              </Link>
              <Link
                href="#join"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
              >
                Join with code
                <ArrowRight className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="join" className="border-b border-white/10 bg-black/[0.18] px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.7fr)] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-normal text-white sm:text-4xl">Join from a room code or meeting link.</h2>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-white/62">
              Guests do not need accounts. Hosts sign in from the lobby to start instant meetings, schedule rooms, and manage recordings.
            </p>
          </div>
          <LandingJoinForm />
        </div>
      </section>

      <section id="features" className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-bold tracking-normal text-white sm:text-5xl">Built for controlled meetings.</h2>
            <p className="mt-4 text-lg leading-7 text-white/62">The shipped app covers the full hosted-room flow, from scheduling to downloadable recordings.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                <feature.icon className={`size-6 ${feature.color}`} />
                <h3 className="mt-5 font-display text-xl font-semibold tracking-normal text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="stack" className="border-y border-white/10 bg-white/[0.035] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <div>
            <h2 className="font-display text-4xl font-bold tracking-normal text-white sm:text-5xl">Self-hosted by design.</h2>
            <p className="mt-4 text-lg leading-7 text-white/62">
              Huddle keeps tokens, room authority, media routing, and recording storage in the stack you deploy.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {stack.map((item) => (
              <div key={item.name} className="rounded-lg border border-white/10 bg-background/60 p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-md ${item.bg}`}>
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-normal text-white">{item.name}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/56">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-bold tracking-normal text-white">Ready to huddle?</h2>
            <p className="mt-3 text-lg leading-7 text-white/62">Open the lobby to host or paste a shared room code to knock as a guest.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/lobby"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan px-5 py-3 font-display font-semibold text-black transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60"
            >
              Open lobby
              <ArrowRight className="size-5" />
            </Link>
            <Link
              href="#join"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
            >
              Join a room
              <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Structured data for search engines and AI search. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}

const features = [
  {
    title: 'Waiting room',
    copy: 'Guests knock from a clean room link while the host admits or denies them from inside the call.',
    icon: LockKeyhole,
    color: 'text-cyan',
  },
  {
    title: 'Host controls',
    copy: 'Mute, remove, record, and manage participant flow with server-side authority behind every action.',
    icon: ShieldCheck,
    color: 'text-magenta',
  },
  {
    title: 'Screen and chat',
    copy: 'Share a screen, keep a side-channel chat open, and stay in a custom responsive meeting surface.',
    icon: Sparkles,
    color: 'text-emerald-300',
  },
  {
    title: 'Recordings',
    copy: 'Room-composite MP4 recordings are written to self-hosted object storage and downloaded through the API.',
    icon: Download,
    color: 'text-amber-300',
  },
];

const stack = [
  {
    name: 'Next.js web app',
    copy: 'The browser UI handles lobby, guest knock, pre-join checks, call controls, and recording views.',
    icon: Video,
    bg: 'bg-cyan/15 text-cyan',
  },
  {
    name: 'NestJS API',
    copy: 'The server mints short-lived LiveKit tokens and keeps host capabilities away from the client.',
    icon: ShieldCheck,
    bg: 'bg-magenta/15 text-magenta',
  },
  {
    name: 'LiveKit SFU',
    copy: 'Self-hosted WebRTC media, signal, screen share, data channels, and embedded TURN for hard networks.',
    icon: RadioTower,
    bg: 'bg-emerald-300/15 text-emerald-300',
  },
  {
    name: 'Postgres, Redis, MinIO',
    copy: 'Persistent rooms, shared knock state, deployment-ready LiveKit state, and private recording storage.',
    icon: Server,
    bg: 'bg-amber-300/15 text-amber-300',
  },
];

function LandingScene() {
  const participants = [
    { name: 'Ada', initials: 'AR', state: 'Host', accent: 'border-magenta/60 bg-magenta/18' },
    { name: 'Jun', initials: 'JL', state: 'Sharing', accent: 'border-cyan/60 bg-cyan/18' },
    { name: 'Mara', initials: 'MK', state: 'Muted', accent: 'border-indigo-300/60 bg-indigo-300/15' },
    { name: 'Theo', initials: 'TS', state: 'Guest', accent: 'border-emerald-300/55 bg-emerald-300/12' },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,oklch(0.08_0.02_265/0.9),oklch(0.17_0.035_280/0.72)_48%,oklch(0.12_0.025_215/0.84))]" />
      <div className="absolute inset-0 bg-[radial-gradient(oklch(0.92_0.05_320/0.12)_1px,transparent_1.6px)] bg-[length:28px_28px]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute left-[32%] top-[14%] hidden w-[62rem] max-w-[82vw] rotate-[-2deg] xl:left-[35%] lg:block">
        <div className="cyber-frame cyber-clip shadow-[0_28px_90px_oklch(0_0_0/0.55)]">
          <div className="cyber-clip bg-black/45 p-4">
            <div className="grid grid-cols-4 gap-3">
              {participants.map((participant) => (
                <div key={participant.name} className={`cyber-clip min-h-44 border ${participant.accent} p-4 backdrop-blur`}>
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-black/45 px-2 py-1 text-xs text-white/72">{participant.state}</span>
                      <span className="size-2 rounded-full bg-cyan shadow-[0_0_16px_oklch(0.82_0.15_200)]" />
                    </div>
                    <div className="grid place-items-center">
                      <span className="grid size-20 place-items-center rounded-full bg-white/12 font-display text-2xl font-bold text-white">
                        {participant.initials}
                      </span>
                    </div>
                    <span className="w-fit rounded-md bg-black/50 px-2.5 py-1 text-sm font-medium text-white/78">{participant.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {['Mic', 'Cam', 'Share'].map((item) => (
                  <span key={item} className="rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-sm text-white/66">
                    {item}
                  </span>
                ))}
              </div>
              <span className="rounded-md bg-magenta px-4 py-2 font-display font-semibold text-white shadow-[0_0_24px_oklch(0.66_0.27_350/0.35)]">
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-5 top-28 w-56 rounded-lg border border-cyan/25 bg-cyan/10 p-4 text-cyan shadow-[0_0_50px_oklch(0.82_0.15_200/0.16)] sm:right-10 lg:right-20">
        <p className="font-display text-sm font-semibold text-white">Room status</p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Signal</span>
            <span className="text-white">WSS</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Media</span>
            <span className="text-white">WebRTC</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Storage</span>
            <span className="text-white">MinIO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
