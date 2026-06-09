"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadHostSession, clearHostSession } from "@/lib/hostSession";
import CallStage from "./CallStage";
import GuestGate from "./GuestGate";
import HostPanel from "./HostPanel";
import { Centered } from "./ui";

// Role router for a managed room (Phase 6). Role is derived from the host
// session, never the URL: whoever created the room in the lobby has its token +
// hostKey + name in sessionStorage and connects directly to the host panel;
// everyone else is a guest who must knock and be admitted (GuestGate). Keeping
// role out of the URL means a shared link is just the Room Code.
export default function RoomClient({ room }: { room: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    clearHostSession(room);
    router.push("/");
  }, [room, router]);

  // Host session is read once on mount (sessionStorage isn't available during
  // SSR, and reading it client-side avoids a hydration mismatch). Its presence
  // is what makes someone the host; absence makes them a guest.
  const [host, setHost] = useState<ReturnType<typeof loadHostSession>>(null);
  const [hostChecked, setHostChecked] = useState(false);
  useEffect(() => {
    // Client-only: sessionStorage isn't available during SSR, so the host
    // session can only be read after mount. The setState-in-effect here is
    // intentional (one-shot hydration of a client-only value), not a render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(loadHostSession(room));
    setHostChecked(true);
  }, [room]);

  if (error) {
    return (
      <Centered>
        <p className="text-magenta text-glow-magenta">{error}</p>
        <button
          onClick={leave}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
        >
          Back to lobby
        </button>
      </Centered>
    );
  }

  // Decide the role only after the host session has been read on the client.
  if (!hostChecked) {
    return (
      <Centered>
        <p className="text-white/60">Loading…</p>
      </Centered>
    );
  }

  // No host session → guest. They collect their name as part of the Device
  // Check inside GuestGate (which also gates the knock), so none is needed here.
  if (!host) {
    return <GuestGate room={room} onLeave={leave} onError={setError} />;
  }

  // Host session present → host.
  return (
    <CallStage
      connection={{ token: host.token, livekitUrl: host.livekitUrl }}
      displayName={host.name}
      onLeave={leave}
      onError={setError}
      overlay={<HostPanel room={room} hostKey={host.hostKey} />}
    />
  );
}
