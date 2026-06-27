'use client';

import { useLocalParticipant, useRoomContext, useRoomInfo } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { RECORD_TOPIC, broadcastRecordMessage, decode, sendRecordMessage } from '@/lib/recordProtocol';

export type IncomingRecordRequest = {
  requesterId: string;
  requesterName: string;
};

export type RecordOutcome = { kind: 'approved' } | { kind: 'denied' } | { kind: 'timed-out' };

// Non-host request lifecycle: idle → pending (host deciding). On approval the
// recording starts immediately (the host's approve does it server-side), so
// there is no "approved, press Start" state — we jump straight to recording.
type RequestPhase = 'idle' | 'pending';

const REQUEST_TIMEOUT_MS = 30_000;
const OUTCOME_DISPLAY_MS = 4_000;

export function useRecording({ room, token, isHost, hostKey }: { room: string; token: string; isHost: boolean; hostKey?: string }) {
  const lkRoom = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { metadata } = useRoomInfo();

  // The room-wide Recording Indicator: a flag in the room metadata (set by the
  // API on start, cleared by the egress webhook on end). Visible to everyone.
  const recordingActive = useMemo(() => {
    if (!metadata) return false;
    try {
      return (JSON.parse(metadata) as { recording?: unknown }).recording === true;
    } catch {
      return false;
    }
  }, [metadata]);

  // When the recording started (server-stamped, ms epoch), for the live timer in
  // the Recording Indicator. Stamped alongside the flag, so it propagates to
  // every client the same way and is correct even for someone who joined late.
  const recordingStartedAt = useMemo(() => {
    if (!metadata) return null;
    try {
      const v = (JSON.parse(metadata) as { recordingStartedAt?: unknown }).recordingStartedAt;
      return typeof v === 'number' ? v : null;
    } catch {
      return null;
    }
  }, [metadata]);

  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [incoming, setIncoming] = useState<IncomingRecordRequest | null>(null);
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);
  const [iAmRecorder, setIAmRecorder] = useState(false);
  const [busy, setBusy] = useState(false);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);

  const clearPendingTimer = () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  };

  const showOutcome = useCallback((o: RecordOutcome) => {
    setOutcome(o);
    if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    outcomeTimerRef.current = setTimeout(() => setOutcome(null), OUTCOME_DISPLAY_MS);
  }, []);

  // Clear "I'm the recorder" only when the recording actually *ends* (the
  // metadata flag goes true→false), not during the brief gap after Start before
  // the flag has propagated — otherwise the Stop button would flicker away.
  useEffect(() => {
    if (wasActiveRef.current && !recordingActive) setIAmRecorder(false);
    wasActiveRef.current = recordingActive;
  }, [recordingActive]);

  // Listen for request/approve/deny.
  useEffect(() => {
    function handleData(payload: Uint8Array, _participant?: RemoteParticipant, _kind?: unknown, topic?: string) {
      if (topic !== RECORD_TOPIC) return;
      const msg = decode(payload);
      if (!msg) return;

      switch (msg.type) {
        case 'record:request':
          // Only the host acts on requests; ignore our own broadcast echo.
          if (isHost) setIncoming({ requesterId: msg.requesterId, requesterName: msg.requesterName });
          break;
        case 'record:approve':
          setPhase((prev) => {
            if (prev !== 'pending') return prev;
            clearPendingTimer();
            // Approval means the host already started the recording, attributed
            // to us — take ownership so the Stop button shows immediately, even
            // before the room metadata flag propagates.
            setIAmRecorder(true);
            showOutcome({ kind: 'approved' });
            return 'idle';
          });
          break;
        case 'record:deny':
          setPhase((prev) => {
            if (prev !== 'pending') return prev;
            clearPendingTimer();
            showOutcome({ kind: 'denied' });
            return 'idle';
          });
          break;
      }
    }
    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => {
      lkRoom.off(RoomEvent.DataReceived, handleData);
    };
  }, [lkRoom, isHost, showOutcome]);

  // Drop a pending incoming request if the requester leaves.
  useEffect(() => {
    if (!incoming) return;
    function handleDisconnect(participant: RemoteParticipant) {
      if (participant.identity === incoming?.requesterId) setIncoming(null);
    }
    lkRoom.on(RoomEvent.ParticipantDisconnected, handleDisconnect);
    return () => {
      lkRoom.off(RoomEvent.ParticipantDisconnected, handleDisconnect);
    };
  }, [lkRoom, incoming]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    };
  }, []);

  // --- Requester (non-host) actions ---
  const requestToRecord = useCallback(async () => {
    await broadcastRecordMessage(localParticipant, {
      type: 'record:request',
      requesterId: localParticipant.identity,
      requesterName: localParticipant.name || localParticipant.identity,
    });
    setPhase('pending');
    clearPendingTimer();
    pendingTimerRef.current = setTimeout(() => {
      setPhase((prev) => {
        if (prev !== 'pending') return prev;
        showOutcome({ kind: 'timed-out' });
        return 'idle';
      });
      pendingTimerRef.current = null;
    }, REQUEST_TIMEOUT_MS);
  }, [localParticipant, showOutcome]);

  const cancelRequest = useCallback(() => {
    clearPendingTimer();
    setPhase('idle');
  }, []);

  const stopRecording = useCallback(async () => {
    setBusy(true);
    try {
      await api.stopRecordingAsParticipant(room, token);
    } catch {
      // The host may have stopped it already; metadata will reconcile.
    } finally {
      setBusy(false);
    }
  }, [room, token]);

  // --- Host actions ---
  const approve = useCallback(async () => {
    if (!incoming || !hostKey) return;
    const target = incoming.requesterId;
    setIncoming(null);
    try {
      await api.approveRecording(room, target, hostKey);
      await sendRecordMessage(localParticipant, target, { type: 'record:approve' });
    } catch {
      // If the grant write failed, tell them no rather than leave a dead button.
      await sendRecordMessage(localParticipant, target, { type: 'record:deny' });
    }
  }, [incoming, hostKey, room, localParticipant]);

  const deny = useCallback(async () => {
    if (!incoming) return;
    const target = incoming.requesterId;
    setIncoming(null);
    await sendRecordMessage(localParticipant, target, { type: 'record:deny' });
  }, [incoming, localParticipant]);

  return {
    recordingActive,
    recordingStartedAt,
    iAmRecorder,
    phase,
    busy,
    // Host-side
    incoming,
    approve,
    deny,
    // Requester-side
    requestToRecord,
    cancelRequest,
    stopRecording,
    outcome,
    dismissOutcome: () => setOutcome(null),
  };
}
