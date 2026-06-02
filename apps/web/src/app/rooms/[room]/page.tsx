import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";

// Server component: unwrap the async route params/query (Next 16) and hand
// the room + display name to the client connector.
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { room } = await params;
  const { name } = await searchParams;

  const roomName = decodeURIComponent(room);
  const displayName = name?.trim();

  // No display name means the lobby was bypassed — send them back.
  if (!displayName) {
    redirect("/");
  }

  return <RoomClient room={roomName} displayName={displayName} />;
}
