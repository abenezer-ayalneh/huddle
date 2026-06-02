"use client";

import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { makeIdentity } from "@/lib/identity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Connection = { token: string; livekitUrl: string };

export default function RoomClient({
  room,
  displayName,
}: {
  room: string;
  displayName: string;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable identity for the lifetime of this room view.
  const identity = useMemo(() => makeIdentity(displayName), [displayName]);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const res = await fetch(`${API_URL}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, identity, name: displayName }),
        });
        if (!res.ok) {
          throw new Error(`Token request failed (${res.status})`);
        }
        const data = (await res.json()) as Connection;
        if (!cancelled) setConnection(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not connect");
        }
      }
    }

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [room, identity, displayName]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20"
        >
          Back to lobby
        </button>
      </main>
    );
  }

  if (!connection) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-black/60 dark:text-white/60">Connecting…</p>
      </main>
    );
  }

  return (
    <main className="flex-1" data-lk-theme="default">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.livekitUrl}
        connect
        video
        audio
        onDisconnected={() => router.push("/")}
        style={{ height: "100dvh" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </main>
  );
}
