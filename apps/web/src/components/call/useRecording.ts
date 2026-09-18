'use client';

import { useLocalParticipant, useRoomContext, useRoomInfo } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { RECORD_TOPIC, broadcastRecordMessage, decode, sendRecordMessage } from '@/lib/recordProtocol';

export type IncomingRecordRequest = {
  requestId: string;
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
  const recordingMetadata = useMemo(() => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata) as { recording?: unknown; recordingStartedAt?: unknown; recordingId?: unknown; recordingShareAvailable?: unknown };
    } catch {
      return {};
    }
  }, [metadata]);

  const recordingActive = recordingMetadata.recording === true;

  // When the recording started (server-stamped, ms epoch), for the live timer in
  // the Recording Indicator. Stamped alongside the flag, so it propagates to
  // every client the same way and is correct even for someone who joined late.
  const recordingStartedAt = typeof recordingMetadata.recordingStartedAt === 'number' ? recordingMetadata.recordingStartedAt : null;
  const recordingId = typeof recordingMetadata.recordingId === 'string' ? recordingMetadata.recordingId : null;
  const recordingShareAvailable = recordingMetadata.recordingShareAvailable === true;

  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [incoming, setIncoming] = useState<IncomingRecordRequest | null>(null);
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);
  const [iAmRecorder, setIAmRecorder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopFailure, setStopFailure] = useState(false);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);
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
          if (isHost) setIncoming({ requestId: msg.requestId, requesterId: msg.requesterId, requesterName: msg.requesterName });
          break;
        case 'record:cancel':
          setIncoming((current) => (current?.requestId === msg.requestId && current.requesterId === msg.requesterId ? null : current));
          break;
        case 'record:approve':
          setPhase((prev) => {
            if (prev !== 'pending' || pendingRequestIdRef.current !== msg.requestId) return prev;
            clearPendingTimer();
            pendingRequestIdRef.current = null;
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
            if (prev !== 'pending' || pendingRequestIdRef.current !== msg.requestId) return prev;
            clearPendingTimer();
            pendingRequestIdRef.current = null;
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
    const requestId = crypto.randomUUID();
    pendingRequestIdRef.current = requestId;
    setPhase('pending');
    await broadcastRecordMessage(localParticipant, {
      type: 'record:request',
      requestId,
      requesterId: localParticipant.identity,
      requesterName: localParticipant.name || localParticipant.identity,
    });
    clearPendingTimer();
    pendingTimerRef.current = setTimeout(() => {
      setPhase((prev) => {
        if (prev !== 'pending') return prev;
        pendingRequestIdRef.current = null;
        showOutcome({ kind: 'timed-out' });
        return 'idle';
      });
      pendingTimerRef.current = null;
    }, REQUEST_TIMEOUT_MS);
  }, [localParticipant, showOutcome]);

  const cancelRequest = useCallback(() => {
    const requestId = pendingRequestIdRef.current;
    pendingRequestIdRef.current = null;
    clearPendingTimer();
    setPhase('idle');
    if (requestId) {
      void broadcastRecordMessage(localParticipant, {
        type: 'record:cancel',
        requestId,
        requesterId: localParticipant.identity,
      }).catch(() => undefined);
    }
  }, [localParticipant]);

  const stopRecording = useCallback(
    async (retry = false) => {
      if (stopping && !retry) return;
      // Keep the metadata-backed indicator intact; only the local Stop action
      // disappears while the authoritative end state catches up.
      setStopping(true);
      setStopFailure(false);
      setBusy(true);
      const deadline = Date.now() + 10_000;
      let pause = 250;
      while (Date.now() < deadline) {
        try {
          await api.stopRecordingAsParticipant(room, token, 2_000);
          setBusy(false);
          return;
        } catch {
          await new Promise<void>((resolve) => window.setTimeout(resolve, pause));
          pause = Math.min(pause * 2, 2_000);
        }
      }
      setBusy(false);
      setStopFailure(true);
    },
    [room, stopping, token],
  );

  useEffect(() => {
    if (!recordingActive && stopping) setStopping(false);
  }, [recordingActive, stopping]);

  // --- Host actions ---
  const approve = useCallback(async () => {
    if (!incoming || !hostKey) return;
    const target = incoming.requesterId;
    setIncoming(null);
    try {
      await api.approveRecording(room, target, hostKey);
      await sendRecordMessage(localParticipant, target, { type: 'record:approve', requestId: incoming.requestId });
    } catch {
      // If the grant write failed, tell them no rather than leave a dead button.
      await sendRecordMessage(localParticipant, target, { type: 'record:deny', requestId: incoming.requestId });
    }
  }, [incoming, hostKey, room, localParticipant]);

  const deny = useCallback(async () => {
    if (!incoming) return;
    const target = incoming.requesterId;
    setIncoming(null);
    await sendRecordMessage(localParticipant, target, { type: 'record:deny', requestId: incoming.requestId });
  }, [incoming, localParticipant]);

  return {
    recordingActive,
    recordingStartedAt,
    recordingId,
    recordingShareAvailable,
    iAmRecorder,
    phase,
    busy,
    stopping,
    stopFailure,
    // Host-side
    incoming,
    approve,
    deny,
    // Requester-side
    requestToRecord,
    cancelRequest,
    stopRecording,
    retryStopRecording: () => stopRecording(true),
    outcome,
    dismissOutcome: () => setOutcome(null),
  };
}
