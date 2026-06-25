'use client';

import type { LocalUserChoices } from '@livekit/components-react';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import PreJoinScreen from '@/components/call/PreJoinScreen';
import CallStage from './CallStage';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Centered } from './ui';

type Connection = { token: string; livekitUrl: string };

// Guest join flow:
//   1. precheck  — confirm the room exists before prompting for camera/mic.
//   2. check     — the Device Check (PreJoinScreen): name + camera/mic preview.
//                  Completing it and pressing the join button IS the agreement,
//                  and only then is the knock sent.
//   3. waiting   — knock sent; poll for the host's decision. The preview is
//                  unmounted, so the camera/mic stream is released while idle.
//   4. admitted  — re-acquire the chosen devices and hand off to <CallStage>,
//                  which skips its own PreJoin because we pass the choices in.
export default function GuestGate({
  room,
  signedInName,
  onLeave,
  onError,
}: {
  room: string;
  // The signed-in guest's account name, or null for an anonymous guest. When
  // present, the Device Check skips the name field and carries this name into
  // the knock; the server derives the authoritative name from the session
  // regardless (docs/adr/0016).
  signedInName: string | null;
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<'precheck' | 'check' | 'knocking' | 'waiting' | 'denied'>('precheck');
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [knockId, setKnockId] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  // Set when the host admits us into a room that has Mute on Entry on, so we
  // connect with the mic off.
  const [startMuted, setStartMuted] = useState(false);

  // Precheck: the room must exist before we ever ask for camera/mic, so a guest
  // never grants permission for a dead room. 404 ends the flow immediately.
  useEffect(() => {
    let active = true;
    api
      .getPublicRoom(room)
      .then(() => {
        if (!active) return;
        setPhase('check');
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      });
    return () => {
      active = false;
    };
  }, [room, onError]);

  // Device Check complete → send the knock, carrying the entered name. This runs
  // from a button click (not an effect), so it can't double-fire under
  // StrictMode; the ref guards against a stray second submit.
  const knockedRef = useRef(false);
  const submitCheck = useCallback(
    async (userChoices: LocalUserChoices) => {
      if (knockedRef.current) return;
      knockedRef.current = true;
      setChoices(userChoices);
      setPhase('knocking');
      try {
        const res = await api.knock(room, userChoices.username);
        setKnockId(res.knockId);
        setPhase('waiting');
      } catch (e) {
        knockedRef.current = false;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      }
    },
    [room, onError],
  );

  // Poll the host's decision once we have a knock.
  useEffect(() => {
    if (!knockId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.knockStatus(room, knockId!);
        if (cancelled) return;
        if (res.status === 'admitted' && res.token && res.livekitUrl) {
          setStartMuted(res.muteOnEntry === true);
          setConnection({ token: res.token, livekitUrl: res.livekitUrl });
          return;
        }
        if (res.status === 'denied') {
          setPhase('denied');
          return;
        }
      } catch {
        // Transient — keep waiting and retry.
      }
      timer = setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [knockId, room]);

  // Withdraw the pending knock before leaving, so the host stops seeing it.
  // Best-effort: navigate home regardless of whether the request succeeds.
  const cancel = useCallback(async () => {
    if (knockId) {
      try {
        await api.cancelKnock(room, knockId);
      } catch {
        // ignore — the host can still deny a stale knock
      }
    }
    onLeave();
  }, [knockId, room, onLeave]);

  // Admitted: re-acquire the chosen devices and enter the call. CallStage skips
  // its own PreJoin because we hand it the choices made before the knock.
  if (connection && choices) {
    return (
      <CallStage
        room={room}
        connection={connection}
        displayName={choices.username}
        initialChoices={choices}
        startMuted={startMuted}
        onLeave={onLeave}
        onError={onError}
      />
    );
  }

  if (phase === 'denied') {
    return (
      <Centered>
        <p className="font-display text-lg text-magenta text-glow-magenta">Entry declined</p>
        <p className="text-sm text-white/60">The host declined your request to join.</p>
        <button
          onClick={onLeave}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lobby
        </button>
      </Centered>
    );
  }

  // Device Check: camera/mic preview, plus a name field only for an anonymous
  // guest. A signed-in guest's name comes from their account, so it is carried
  // forward silently and the field is hidden. The join button sends the knock.
  if (phase === 'check') {
    return (
      <PreJoinScreen
        defaults={{ username: signedInName ?? '', videoEnabled: true, audioEnabled: true }}
        onSubmit={submitCheck}
        // The Device Check is informational: a denied or missing camera/mic must
        // not block the knock, so device errors are logged, not surfaced.
        onError={(e) => console.warn('Device Check error (continuing):', e.message)}
        heading="Join meeting"
        subheading={`Check your camera and mic, then ask to join “${room}”.`}
        submitLabel="Ask to join"
        requireName={!signedInName}
      />
    );
  }

  // precheck / knocking / waiting
  return (
    <Centered>
      {phase === 'waiting' ? (
        <WaitingRoom room={room} onCancel={cancel} />
      ) : phase === 'precheck' ? (
        <LoadingSpinner className="mx-auto size-12" />
      ) : (
        <p className="text-white/60">Requesting to join…</p>
      )}
    </Centered>
  );
}

// Pulsing ring while waiting for the host. Two offset rings (magenta + cyan)
// expand outward from a glowing core.
function WaitingRoom({ room, onCancel }: { room: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <span className="pulse-ring absolute inset-6" />
        <div className="neon-magenta flex h-20 w-20 items-center justify-center rounded-full bg-[oklch(0.66_0.27_350_/_0.18)] font-display text-2xl font-bold tracking-[0.2em] text-white">
          H
        </div>
      </div>

      <div className="space-y-1.5 text-center">
        <p className="font-display text-lg text-white">Waiting for the host…</p>
        <p className="text-sm text-white/55">
          You&apos;ll join <span className="font-mono text-cyan">{room}</span> the moment you&apos;re let in.
        </p>
      </div>

      <button
        onClick={onCancel}
        className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
      >
        Cancel request
      </button>
    </div>
  );
}
