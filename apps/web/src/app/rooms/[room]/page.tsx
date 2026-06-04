import RoomClient from "./RoomClient";

// Server component: unwrap the async route params/query (Next 16) and hand
// the room + display name to the client connector. A guest may arrive via a
// shared link with no name yet; RoomClient prompts for one in that case.
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ name?: string; role?: string }>;
}) {
  const { room } = await params;
  const { name, role } = await searchParams;

  const roomName = decodeURIComponent(room);
  const displayName = name?.trim() || undefined;

  return (
    <RoomClient
      room={roomName}
      displayName={displayName}
      role={role === "host" ? "host" : "guest"}
    />
  );
}
