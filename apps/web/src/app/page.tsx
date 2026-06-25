import HeroCopy from './HeroCopy';
import LobbyAuthCard from './LobbyAuthCard';

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

export default function LobbyPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Ambient neon blobs. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-drift absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-magenta/20 blur-[120px]" />
        <div className="animate-drift absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan/15 blur-[120px] [animation-delay:5s]" />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <HeroCopy />
        <div className="glass-strong w-full max-w-md justify-self-center rounded-2xl p-8 shadow-[0_8px_60px_oklch(0_0_0/0.5)] lg:justify-self-end">
          <LobbyAuthCard />
        </div>
      </div>

      {/* Structured data for search engines and AI search. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
