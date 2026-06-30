'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { loadHostSession, saveHostSession, clearHostSession } from '@/lib/hostSession';
import CallStage from './CallStage';
import GuestGate from './GuestGate';
import HostPanel from './HostPanel';
import ErrorBoundary from '@/components/faults/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Centered } from './ui';

// Role router for a managed room (Phase 6). Role is derived from the host
// session, never the URL: whoever created the room in the lobby has its token +
// hostKey + name in sessionStorage and connects directly to the host panel;
// everyone else is a guest who must knock and be admitted (GuestGate). Keeping
// role out of the URL means a shared link is just the Room Code.
export default function RoomClient({ room }: { room: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    clearHostSession(room);
    router.push('/lobby');
  }, [room, router]);

  const [host, setHost] = useState<ReturnType<typeof loadHostSession>>(null);
  const [hostChecked, setHostChecked] = useState(false);
  useEffect(() => {
    if (sessionPending) return;

    let cancelled = false;
    const resolveHost = async () => {
      const cached = loadHostSession(room);
      if (cached) return cached;
      if (!session) return null;

      // No sessionStorage entry but the user is signed in — try to reclaim
      // ownership via the host-token endpoint. Succeeds only for the room's owner.
      try {
        const result = await api.hostJoin(room);
        const hostSession = {
          token: result.token,
          hostKey: result.hostKey,
          identity: result.identity,
          livekitUrl: result.livekitUrl,
          name: session.user.name,
        };
        saveHostSession(room, hostSession);
        return hostSession;
      } catch {
        // 401/403/network — not the owner or not authenticated; fall through to guest.
        return null;
      }
    };

    resolveHost().then((hostSession) => {
      if (cancelled) return;
      if (hostSession) setHost(hostSession);
      setHostChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [room, session, sessionPending]);

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
        <LoadingSpinner className="mx-auto size-12" />
      </Centered>
    );
  }

  // No host session → guest. A signed-in guest's name comes from their account
  // (never typed); an anonymous guest types it during the Device Check inside
  // GuestGate (docs/adr/0016). The server is the authority either way.
  if (!host) {
    return <GuestGate room={room} signedInName={session?.user.name ?? null} onLeave={leave} onError={setError} />;
  }

  // Host session present → host.
  return (
    <CallStage
      room={room}
      connection={{ token: host.token, livekitUrl: host.livekitUrl }}
      displayName={host.name}
      onLeave={leave}
      onError={setError}
      overlay={
        <ErrorBoundary label="Host panel" fallback={null}>
          <HostPanel room={room} hostKey={host.hostKey} />
        </ErrorBoundary>
      }
      isHost
      hostKey={host.hostKey}
    />
  );
}
