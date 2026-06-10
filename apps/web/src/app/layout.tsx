import type { Metadata } from "next";
import { Exo_2, Rajdhani } from "next/font/google";
import "./globals.css";

// Exo 2 — geometric, futuristic display face for headings and brand.
const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
});

// Rajdhani — techy, open sans for body and UI. Non-variable, so weights are
// declared explicitly.
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://huddle.abenezer-ayalneh.dev";
const siteName = "Huddle";
const siteTitle = "Huddle — Self-hosted, real-time video for teams who want control";
const siteDescription = "Self-hosted, real-time video for teams who want control";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  title: {
    default: siteName,
    template: "%s | Huddle",
  },
  description: siteDescription,
  keywords: ["Call", "Video", "Video Call", "Huddle", "Meeting", "Conference Call", "Abenezer Ayalneh"],
  authors: [{ name: "Abenezer Ayalneh", url: "https://abenezer-ayalneh.dev" }],
  creator: "Abenezer Ayalneh",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    siteName: siteName,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
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
      <body className="bg-dotgrid min-h-full flex flex-col">{children}</body>
    </html>
  );
}
