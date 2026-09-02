'use client';

import type { LocalUserChoices } from '@livekit/components-react';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import PreJoinScreen from '@/components/call/PreJoinScreen';
import { DIRECT_REJOIN_NOT_ALLOWED } from '@/lib/faultCodes';
import CallStage from './CallStage';
import MeetingLoadingScreen, { type MeetingLoadingStage } from '@/components/call/MeetingLoadingScreen';
import MeetingEntryShell from '@/components/call/MeetingEntryShell';

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
// A signed-in Guest with a Direct Rejoin Grant still completes the Device Check,
// but its submit action mints a fresh token instead of creating another Knock.
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
  const [phase, setPhase] = useState<'precheck' | 'check' | 'knocking' | 'rejoining' | 'waiting' | 'denied'>('precheck');
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [knockId, setKnockId] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [rejoinEligible, setRejoinEligible] = useState(false);
  const [entryVersion, setEntryVersion] = useState(0);
  // Set when the host admits us into a room that has Mute on Entry on, so we
  // connect with the mic off.
  const [startMuted, setStartMuted] = useState(false);

  // Precheck: the room must exist before we ever ask for camera/mic. A signed-in
  // Guest also checks their Direct Rejoin Grant before we choose the Device
  // Check copy and submit behavior.
  useEffect(() => {
    let active = true;
    async function precheck() {
      try {
        await api.getPublicRoom(room);
        if (!active) return;
        const eligible = signedInName ? await api.directRejoinEligibility(room) : { eligible: false };
        if (!active) return;
        setRejoinEligible(eligible.eligible);
        setPhase('check');
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      }
    }
    void precheck();
    return () => {
      active = false;
    };
  }, [room, signedInName, onError, entryVersion]);

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
        if (rejoinEligible) {
          setPhase('rejoining');
          const res = await api.directRejoin(room);
          setStartMuted(res.muteOnEntry);
          setConnection({ token: res.token, livekitUrl: res.livekitUrl });
          return;
        }
        const res = await api.knock(room, userChoices.username);
        setKnockId(res.knockId);
        setPhase('waiting');
      } catch (e) {
        knockedRef.current = false;
        if (rejoinEligible && e instanceof ApiError && e.code === DIRECT_REJOIN_NOT_ALLOWED) {
          // The call ended or the host removed us after the eligibility check.
          // Do not silently create a Knock: return to a normal Device Check so
          // the Guest explicitly chooses "Ask to join".
          setRejoinEligible(false);
          setChoices(null);
          setPhase('check');
          return;
        }
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      }
    },
    [room, onError, rejoinEligible],
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

  // LiveKit has already exhausted its transparent reconnect attempts when this
  // fires. Keep the Guest on the room route, release the old CallStage, and
  // re-check the server-side grant before showing a fresh Device Check.
  const recoverFromDisconnect = useCallback(() => {
    knockedRef.current = false;
    setConnection(null);
    setChoices(null);
    setKnockId(null);
    setStartMuted(false);
    setRejoinEligible(false);
    setPhase('precheck');
    setEntryVersion((version) => version + 1);
  }, []);

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
        onDisconnected={recoverFromDisconnect}
        onError={onError}
      />
    );
  }

  if (phase === 'denied') {
    return (
      <MeetingEntryShell
        room={room}
        kicker="Guest request"
        title="Entry was declined."
        lede="The Host declined this request. Return to the lobby and check the Room Code before trying again."
        panelLabel="Admission denied"
        tone="denied"
        headingId="meeting-denied-title"
        panelLabelId="meeting-denied-panel-label"
        panelRole="alert"
        panelClassName="meeting-denied-panel"
      >
        <div className="meeting-error-mark meeting-denied-mark" aria-hidden="true">
          <span aria-hidden="true">×</span>
        </div>

        <p className="meeting-loading-status">The Host said no</p>
        <p className="meeting-error-message">This request is closed. Ask the Host for a new Room Code if you think this was a mistake.</p>

        <div className="meeting-error-actions">
          <button type="button" className="meeting-error-secondary meeting-denied-action" onClick={onLeave}>
            <ArrowLeft aria-hidden="true" />
            Back to lobby
          </button>
        </div>
      </MeetingEntryShell>
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
        // A denied or missing camera/mic never blocks the knock — Device
        // Recovery (docs/adr/0023) handles it in place on the Device Check.
        heading={rejoinEligible ? 'Rejoin meeting' : 'Join meeting'}
        subheading={rejoinEligible ? `Check your camera and mic, then rejoin “${room}”.` : `Check your camera and mic, then ask to join “${room}”.`}
        submitLabel={rejoinEligible ? 'Rejoin call' : 'Ask to join'}
        requireName={!signedInName}
        roomName={room}
      />
    );
  }

  if (phase === 'waiting') return <WaitingRoom room={room} onCancel={cancel} />;

  const loadingStage: MeetingLoadingStage = phase === 'precheck' ? 'checking' : phase === 'rejoining' ? 'rejoining' : 'requesting';
  return <MeetingLoadingScreen room={room} stage={loadingStage} />;
}

// Waiting-room content lives in the shared Signal Handoff entry shell so the
// admission state reads like the rest of room entry, not like the call stage.
function WaitingRoom({ room, onCancel }: { room: string; onCancel: () => void }) {
  return (
    <MeetingEntryShell
      room={room}
      kicker="Waiting Room"
      title="Waiting for the Host."
      lede="Your request is with the Host. Keep this tab open; we’ll let you in as soon as they admit you."
      panelLabel="Admission request"
      headingId="meeting-waiting-title"
      panelLabelId="meeting-waiting-panel-label"
    >
      <div className="meeting-waiting-mark" aria-hidden="true">
        <span className="meeting-waiting-beacon meeting-waiting-beacon-one" />
        <span className="meeting-waiting-beacon meeting-waiting-beacon-two" />
        <span className="meeting-waiting-mark-core">H</span>
      </div>

      <p className="meeting-loading-status">Request sent</p>
      <p className="meeting-entry-panel-copy">The Host will admit you when they’re ready. This page checks automatically.</p>

      <div className="meeting-error-actions meeting-waiting-actions">
        <button type="button" className="meeting-error-secondary" onClick={onCancel}>
          <ArrowLeft aria-hidden="true" />
          Withdraw request
        </button>
      </div>
    </MeetingEntryShell>
  );
}
