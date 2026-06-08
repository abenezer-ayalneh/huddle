import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Huddle",
  description: "Self-hosted video conferencing on LiveKit",
};

// Inline script that runs before first paint to sync the .dark class with the
// system color-scheme preference. This avoids a flash of the wrong theme.
const darkModeScript = `(function(){
  var m = window.matchMedia('(prefers-color-scheme: dark)');
  function s(e){document.documentElement.classList.toggle('dark',e.matches)}
  s(m);m.addEventListener('change',s);
})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // suppressHydrationWarning: the inline script may add .dark before React
      // hydrates, which is intentional — suppress the mismatch warning.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
