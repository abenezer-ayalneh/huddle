import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import FaultLayer from '@/components/faults/FaultLayer';
import { publicConfig } from '@/lib/public-config';
import './globals.css';

// The site's display and UI typefaces are vendored so production builds do not
// require access to Google Fonts. The files in ./fonts are Latin subsets from
// the OFL-licensed Archivo and IBM Plex Mono families.
const archivoBlack = localFont({
  src: './fonts/archivo-black-latin.woff2',
  variable: '--font-archivo-black',
  display: 'swap',
  weight: '400',
});

const archivo = localFont({
  src: './fonts/archivo-latin-variable.woff2',
  variable: '--font-archivo',
  display: 'swap',
  weight: '400 700',
});

const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400.woff2', weight: '400' },
    { path: './fonts/ibm-plex-mono-latin-500.woff2', weight: '500' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
});

const { siteUrl, operatorName, operatorContactUrl } = publicConfig;
// Search Console issues this value for its optional URL-prefix verification
// method. It is a public ownership token, so it may be exposed in page metadata.
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const siteName = 'Huddle';
const siteTitle = 'Huddle - Self-hosted video conferencing on LiveKit';
const siteDescription =
  'Huddle is self-hosted browser meeting software for teams that want to review, decide, and work together in a room they control. Try the capacity-limited evaluation demo or deploy your own stack.';

const themeBootstrap = `(() => {
  try {
    const saved = window.localStorage.getItem('huddle-theme');
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/logo.svg?v=3', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.svg?v=3', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-32x32.png?v=3', type: 'image/png', sizes: '32x32', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark-32x32.png?v=3', type: 'image/png', sizes: '32x32', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-16x16.png?v=3', type: 'image/png', sizes: '16x16', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark-16x16.png?v=3', type: 'image/png', sizes: '16x16', media: '(prefers-color-scheme: dark)' },
    ],
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
  authors: [{ name: operatorName, url: operatorContactUrl }],
  creator: operatorName,
  publisher: operatorName,
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
    // on a dark base for legacy app routes. The landing reads the separate
    // data-theme attribute and can follow the system preference.
    <html lang="en" className={`dark ${archivoBlack.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body className="bg-dotgrid min-h-full flex flex-col">
        {children}
        {/* App-wide Fault surfaces: the quiet reachability banner + the Fault
            toast, mounted once above every route (docs/adr/0017, 0019). */}
        <FaultLayer />
      </body>
    </html>
  );
}
