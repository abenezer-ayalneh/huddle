"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadHostSession, clearHostSession } from "@/lib/hostSession";
import CallStage from "./CallStage";
import GuestGate from "./GuestGate";
import HostPanel from "./HostPanel";
import { Centered } from "./ui";

// Role router for a managed room (Phase 6):
//  - host: created the room in the lobby; its token + hostKey live in
//    sessionStorage. Connects directly and gets the host control panel.
//  - guest: must knock and be admitted (GuestGate) before connecting.
export default function RoomClient({
  room,
  displayName,
  role,
}: {
  room: string;
  displayName: string;
  role: "host" | "guest";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    clearHostSession(room);
    router.push("/");
  }, [room, router]);

  // Host session is read once on mount (sessionStorage isn't available during SSR).
  const [host, setHost] = useState<ReturnType<typeof loadHostSession>>(null);
  const [hostChecked, setHostChecked] = useState(false);
  useEffect(() => {
    if (role === "host") setHost(loadHostSession(room));
    setHostChecked(true);
  }, [role, room]);

  if (error) {
    return (
      <Centered>
        <p className="text-red-500">{error}</p>
        <button
          onClick={leave}
          className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20"
        >
          Back to lobby
        </button>
      </Centered>
    );
  }

  if (role === "guest") {
    return (
      <GuestGate
        room={room}
        displayName={displayName}
        onLeave={leave}
        onError={setError}
      />
    );
  }

  // role === "host"
  if (!hostChecked) {
    return (
      <Centered>
        <p className="text-black/60 dark:text-white/60">Loading…</p>
      </Centered>
    );
  }
  if (!host) {
    return (
      <Centered>
        <p className="text-red-500">
          Your host session for “{room}” has expired. Create the room again.
        </p>
        <button
          onClick={leave}
          className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20"
        >
          Back to lobby
        </button>
      </Centered>
    );
  }

  return (
    <CallStage
      connection={{ token: host.token, livekitUrl: host.livekitUrl }}
      displayName={displayName}
      onLeave={leave}
      onError={setError}
      overlay={<HostPanel room={room} hostKey={host.hostKey} />}
    />
  );
}
