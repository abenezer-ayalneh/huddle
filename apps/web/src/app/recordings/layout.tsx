import type { Metadata } from 'next';

// The recordings dashboard is session-gated and lists host-owned artifacts —
// nothing here should ever surface in search results or AI search summaries.
// robots.ts also disallows the path; this is the per-route reinforcement.
export const metadata: Metadata = {
  title: 'Recordings',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function RecordingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
