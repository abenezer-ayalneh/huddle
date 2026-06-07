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
  displayName?: string;
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
    // Client-only: sessionStorage isn't available during SSR, so the host
    // session can only be read after mount. The setState-in-effect here is
    // intentional (one-shot hydration of a client-only value), not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (role === "host") setHost(loadHostSession(room));
    setHostChecked(true);
  }, [role, room]);

  // A guest opening a shared link has no display name yet — collect one and
  // put it in the URL so a refresh keeps it. (Hosts always arrive with a name.)
  if (!displayName) {
    return <NameGate room={room} />;
  }

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

// Guest landing on a shared link: collect a display name, then re-enter the
// room with it in the URL so a refresh (or the knock poll) keeps it.
function NameGate({ room }: { room: string }) {
  const router = useRouter();
  const [name, setName] = useState("");

  function join() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const params = new URLSearchParams({ name: trimmed, role: "guest" });
    router.replace(`/rooms/${encodeURIComponent(room)}?${params}`);
  }

  return (
    <Centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-8 shadow-sm dark:border-white/15"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Join meeting</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter your name to ask the host to let you in.
          </p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="off"
          className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Continue
        </button>
      </form>
    </Centered>
  );
}
