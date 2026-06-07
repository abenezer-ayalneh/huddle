import RoomClient from "./RoomClient";

// Server component: unwrap the async route params (Next 16) and hand the room
// to the client connector. The URL carries nothing but the Room Code — role
// (host vs guest) and the host's name come from the host session in
// sessionStorage, so a shared link is always clean.
export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;

  return <RoomClient room={decodeURIComponent(room)} />;
}
