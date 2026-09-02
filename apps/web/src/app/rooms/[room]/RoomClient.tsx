'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { loadHostSession, saveHostSession, clearHostSession } from '@/lib/hostSession';
import CallStage from './CallStage';
import GuestGate from './GuestGate';
import HostPanel from './HostPanel';
import ErrorBoundary from '@/components/faults/ErrorBoundary';
import MeetingLoadingScreen from '@/components/call/MeetingLoadingScreen';
import MeetingJoinErrorScreen from '@/components/call/MeetingJoinErrorScreen';

// Authentication is optional for a shared Guest link. Do not make a Guest wait
// forever for a session lookup before the public room check can begin.
const ROLE_RESOLUTION_TIMEOUT_MS = 10_000;

// Role router for a managed room (Phase 6). Role is derived from the host
// session, never the URL: whoever created the room in the lobby has its token +
// hostKey + name in sessionStorage and connects directly to the host panel;
// everyone else is a guest handled by GuestGate. First entry requires a Knock;
// an admitted signed-in Guest may have a call-scoped Direct Rejoin Grant.
// Keeping role out of the URL means a shared link is just the Room Code.
export default function RoomClient({ room }: { room: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [hostPanelOpen, setHostPanelOpen] = useState(true);

  const leave = useCallback(() => {
    clearHostSession(room);
    router.push('/lobby');
  }, [room, router]);

  const [host, setHost] = useState<ReturnType<typeof loadHostSession>>(null);
  const [hostChecked, setHostChecked] = useState(false);
  const roleResolutionFinished = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled || roleResolutionFinished.current) return;
      // A shared link is still a valid Guest entry point when auth is offline.
      // GuestGate will perform the public room check and surface its own
      // bounded API error if the room service is unavailable too.
      roleResolutionFinished.current = true;
      setHostChecked(true);
    }, ROLE_RESOLUTION_TIMEOUT_MS);

    if (sessionPending) {
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
    }

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
      if (cancelled || roleResolutionFinished.current) return;
      roleResolutionFinished.current = true;
      window.clearTimeout(timeout);
      if (hostSession) setHost(hostSession);
      setHostChecked(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [room, session, sessionPending]);

  if (error) {
    return <MeetingJoinErrorScreen room={room} message={error} onRetry={() => window.location.reload()} onBack={leave} />;
  }

  // Decide the role only after the host session has been read on the client.
  if (!hostChecked) {
    return <MeetingLoadingScreen room={room} />;
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
          <HostPanel room={room} hostKey={host.hostKey} onOpenChange={setHostPanelOpen} />
        </ErrorBoundary>
      }
      isHost
      hostKey={host.hostKey}
      hostPanelOpen={hostPanelOpen}
    />
  );
}
