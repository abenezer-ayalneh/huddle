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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = "Huddle";
const siteDescription =
  "Self-hosted, browser-based video conferencing on LiveKit. Create or join a room and meet face to face — no installs.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
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
    <html
      lang="en"
      className={`dark ${exo2.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="bg-dotgrid min-h-full flex flex-col">{children}</body>
    </html>
  );
}
