import LandingPageClient from './LandingPageClient';
import Script from 'next/script';
import { publicConfig } from '@/lib/public-config';

const { siteUrl, operatorName, operatorContactUrl, projectRepositoryUrl } = publicConfig;

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Huddle',
    applicationCategory: 'CommunicationApplication',
    applicationSubCategory: 'Self-hosted video conferencing',
    operatingSystem: 'Web',
    url: siteUrl,
    codeRepository: projectRepositoryUrl,
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
    author: { '@type': 'Person', name: operatorName, url: operatorContactUrl },
    publisher: { '@type': 'Person', name: operatorName, url: operatorContactUrl },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Huddle',
    url: siteUrl,
    inLanguage: 'en',
    publisher: { '@type': 'Person', name: operatorName, url: operatorContactUrl },
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
        name: 'Is Huddle a hosted subscription service?',
        acceptedAnswer: { '@type': 'Answer', text: 'No. Huddle is self-hosted software: each operator runs it on infrastructure they control and sets their own service policies.' },
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
      <Script id="huddle-json-ld" type="application/ld+json" strategy="beforeInteractive">
        {JSON.stringify(jsonLd)}
      </Script>
    </>
  );
}
