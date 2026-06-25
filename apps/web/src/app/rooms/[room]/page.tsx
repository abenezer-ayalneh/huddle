import type { Metadata } from 'next';
import RoomClient from './RoomClient';

// Meeting URLs are private — keep them out of search indexes and snippets.
// robots.ts already disallows /rooms/, but a route-level meta tag is the
// belt-and-braces signal that crawlers honor even when they reach the page
// directly (e.g. from a shared link in a public site).
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Server component: unwrap the async route params (Next 16) and hand the room
// to the client connector. The URL carries nothing but the Room Code — role
// (host vs guest) and the host's name come from the host session in
// sessionStorage, so a shared link is always clean.
export default async function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;

  return <RoomClient room={decodeURIComponent(room)} />;
}
