import type { Metadata } from 'next';
import { Exo_2, Rajdhani } from 'next/font/google';
import FaultLayer from '@/components/faults/FaultLayer';
import './globals.css';

// Exo 2: geometric, futuristic display face for headings and brand.
const exo2 = Exo_2({
  variable: '--font-exo2',
  subsets: ['latin'],
});

// Rajdhani: techy, open sans for body and UI. Non-variable, so weights are
// declared explicitly.
const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';
// Search Console issues this value for its optional URL-prefix verification
// method. It is a public ownership token, so it may be exposed in page metadata.
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const siteName = 'Huddle';
const siteTitle = 'Huddle - Self-hosted video conferencing on LiveKit';
const siteDescription =
  'Huddle is a self-hosted, browser-based video conferencing app built on LiveKit. Hosts schedule or start instant meetings; guests join from a shared link through a waiting room, with no account or install. Screen share, in-call chat, recording, and host controls included.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  title: {
    // Use the full positioning string by default so the lobby and OG previews
    // show the full positioning string rather than the bare
    // brand. Child routes still override via the %s template.
    default: siteTitle,
    template: '%s | Huddle',
  },
  description: siteDescription,
  applicationName: siteName,
  category: 'communication',
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
  alternates: {
    canonical: '/',
  },
  keywords: [
    'Huddle',
    'self-hosted video conferencing',
    'LiveKit',
    'WebRTC video calls',
    'browser video meeting',
    'video meeting without account',
    'self-hosted Google Meet alternative',
    'screen sharing',
    'meeting recording',
    'video call app',
  ],
  authors: [{ name: 'Abenezer Ayalneh', url: 'https://abenezer-ayalneh.dev' }],
  creator: 'Abenezer Ayalneh',
  publisher: 'Abenezer Ayalneh',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    siteName: siteName,
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Huddle - Self-hosted video conferencing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark-only: the cyberpunk aesthetic (neon glows, glass, dot-grid) depends
    // on a dark base, so `.dark` is applied statically rather than tracking the
    // system preference.
    <html lang="en" className={`dark ${exo2.variable} ${rajdhani.variable} h-full antialiased`}>
      <body className="bg-dotgrid min-h-full flex flex-col">
        {children}
        {/* App-wide Fault surfaces: the quiet reachability banner + the Fault
            toast, mounted once above every route (docs/adr/0017, 0019). */}
        <FaultLayer />
      </body>
    </html>
  );
}
