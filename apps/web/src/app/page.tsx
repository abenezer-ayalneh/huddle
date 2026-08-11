import LandingPageClient from './LandingPageClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Huddle',
    applicationCategory: 'CommunicationApplication',
    applicationSubCategory: 'Self-hosted video conferencing',
    operatingSystem: 'Web',
    url: siteUrl,
    codeRepository: 'https://github.com/abenezer-ayalneh/huddle',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    description:
      'Huddle is self-hosted browser meeting software for teams that want to review, decide, and work together in a room they control.',
    featureList: [
      'Shared-link guest entry without an account',
      'Device Check and Host-controlled Waiting Room admission',
      'Camera, microphone, Present, and in-call Chat',
      'Visible room-composite Recording with local MinIO retention',
      'Attended, room-scoped Remote Control through a macOS Control Agent',
      'Docker Compose deployment on a VPS or Docker host',
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
        acceptedAnswer: { '@type': 'Answer', text: 'No. Guests open a shared Room Code link, complete the Device Check, Knock, and wait for a Host to Admit them.' },
      },
      {
        '@type': 'Question',
        name: 'Is Huddle self-hosted?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes. Teams run the web app, API, LiveKit, Redis, Postgres, MinIO, and Caddy on infrastructure they control.' },
      },
      {
        '@type': 'Question',
        name: 'What does the Huddle evaluation demo provide?',
        acceptedAnswer: { '@type': 'Answer', text: 'The official deployment is a capacity-limited evaluation environment for trying the full meeting shape; it is not a hosted subscription service.' },
      },
      {
        '@type': 'Question',
        name: 'What license does Huddle use?',
        acceptedAnswer: { '@type': 'Answer', text: 'Huddle is released under the Apache-2.0 license. Third-party components keep their own licenses.' },
      },
    ],
  },
];

export default function LandingPage() {
  return (
    <>
      <LandingPageClient />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
