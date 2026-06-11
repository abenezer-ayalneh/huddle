'use client';

import { useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { RoomEvent, Track, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAgentIdentity, presenterIdentityFor, sendControlMessage } from '@/lib/controlProtocol';
import { PRESENT_TOPIC, decode, sendPresentMessage } from '@/lib/presentProtocol';

export type OutgoingRequest = {
  presenterIdentity: string;
  presenterName: string;
};

export type IncomingRequest = {
  requesterId: string;
  requesterName: string;
};

export type PresentationOutcome =
  | { kind: 'declined'; name: string }
  | { kind: 'timed-out'; name: string }
  | { kind: 'yielded'; name: string }
  | { kind: 'force-taken' };

const REQUEST_TIMEOUT_MS = 30_000;
const OUTCOME_DISPLAY_MS = 4_000;

export function usePresentation(isHost: boolean) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  const presenterTrack = screenTracks[0] ?? null;
  // A controllable presentation is published by the presenter's Control Agent
  // (identity `agent:<presenter>`), not their browser. The person remains the
  // Presenter — resolve the agent identity back to the human everywhere, so
  // the present:* protocol keeps targeting browsers, not agents.
  const publisherIdentity = presenterTrack?.participant.identity ?? null;
  const agentIdentity = publisherIdentity !== null && isAgentIdentity(publisherIdentity) ? publisherIdentity : null;
  const presenterIdentity = publisherIdentity !== null ? presenterIdentityFor(publisherIdentity) : null;
  const presenterName = presenterTrack?.participant.name || presenterIdentity;
  const iAmPresenting = presenterIdentity === localParticipant.identity;
  const someoneElsePresenting = presenterIdentity !== null && !iAmPresenting;

  const [outgoing, setOutgoing] = useState<OutgoingRequest | null>(null);
  const [incoming, setIncoming] = useState<IncomingRequest | null>(null);
  const [outcome, setOutcome] = useState<PresentationOutcome | null>(null);
  const [autoStartTick, setAutoStartTick] = useState(0);
  const autoStartConsumedRef = useRef(0);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStartShare = useRef(false);

  function showOutcome(o: PresentationOutcome) {
    setOutcome(o);
    if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    outcomeTimerRef.current = setTimeout(() => setOutcome(null), OUTCOME_DISPLAY_MS);
  }

  function clearOutgoing() {
    setOutgoing(null);
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
  }

  const startMyShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(true);
    } catch {
      // user cancelled the browser picker
    }
  }, [localParticipant]);

  const stopMyShare = useCallback(async () => {
    // An agent-published share isn't a browser track — tell the agent to stop.
    if (agentIdentity && presenterIdentityFor(agentIdentity) === localParticipant.identity) {
      await sendControlMessage(localParticipant, [agentIdentity], { v: 1, type: 'control:stop-present' });
      return;
    }
    await localParticipant.setScreenShareEnabled(false);
  }, [localParticipant, agentIdentity]);

  // When presenter disappears while we have a pending outgoing request,
  // auto-resolve: drop the request and start our share. The request is cleared
  // as a render-time adjustment (converges: `outgoing` goes null), and the tick
  // hands the side effects (timer cleanup + share start) to the effect below.
  if (outgoing && !someoneElsePresenting) {
    setOutgoing(null);
    setAutoStartTick(autoStartTick + 1);
  }

  useEffect(() => {
    if (autoStartTick === autoStartConsumedRef.current) return;
    autoStartConsumedRef.current = autoStartTick;
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    startMyShare();
  }, [autoStartTick, startMyShare]);

  // After a yield/force-take is received and the presenter's track goes away,
  // we need to start our share. We track this via pendingStartShare ref.
  useEffect(() => {
    if (pendingStartShare.current && !someoneElsePresenting) {
      pendingStartShare.current = false;
      startMyShare();
    }
  }, [someoneElsePresenting, startMyShare]);

  // Listen for incoming data messages on our topic.
  useEffect(() => {
    function handleData(payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) {
      if (topic !== PRESENT_TOPIC || !participant) return;
      const msg = decode(payload);
      if (!msg) return;

      switch (msg.type) {
        case 'present:request':
          if (iAmPresenting) {
            setIncoming({
              requesterId: msg.requesterId,
              requesterName: msg.requesterName,
            });
          }
          break;

        case 'present:yield':
          if (outgoing) {
            clearOutgoing();
            showOutcome({
              kind: 'yielded',
              name: outgoing.presenterName,
            });
            pendingStartShare.current = true;
          }
          break;

        case 'present:decline':
          if (outgoing) {
            showOutcome({
              kind: 'declined',
              name: outgoing.presenterName,
            });
            clearOutgoing();
          }
          break;

        case 'present:force-take':
          if (iAmPresenting) {
            stopMyShare();
            showOutcome({ kind: 'force-taken' });
            setIncoming(null);
          }
          break;
      }
    }

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, iAmPresenting, outgoing, stopMyShare]);

  // Clean up incoming request if the requester disconnects.
  useEffect(() => {
    if (!incoming) return;
    function handleDisconnect(participant: RemoteParticipant) {
      if (participant.identity === incoming?.requesterId) {
        setIncoming(null);
      }
    }
    room.on(RoomEvent.ParticipantDisconnected, handleDisconnect);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, handleDisconnect);
    };
  }, [room, incoming]);

  const requestPresentation = useCallback(async () => {
    if (!presenterIdentity || iAmPresenting) return;

    await sendPresentMessage(localParticipant, presenterIdentity, {
      type: 'present:request',
      requesterId: localParticipant.identity,
      requesterName: localParticipant.name || localParticipant.identity,
    });

    setOutgoing({
      presenterIdentity,
      presenterName: presenterName || presenterIdentity,
    });

    outgoingTimerRef.current = setTimeout(() => {
      setOutgoing((prev) => {
        if (prev) {
          showOutcome({ kind: 'timed-out', name: prev.presenterName });
        }
        return null;
      });
      outgoingTimerRef.current = null;
    }, REQUEST_TIMEOUT_MS);
  }, [presenterIdentity, presenterName, iAmPresenting, localParticipant]);

  const cancelRequest = useCallback(() => {
    clearOutgoing();
  }, []);

  const yieldPresentation = useCallback(async () => {
    if (!incoming) return;
    await sendPresentMessage(localParticipant, incoming.requesterId, {
      type: 'present:yield',
    });
    setIncoming(null);
    await stopMyShare();
  }, [incoming, localParticipant, stopMyShare]);

  const declinePresentation = useCallback(async () => {
    if (!incoming) return;
    await sendPresentMessage(localParticipant, incoming.requesterId, {
      type: 'present:decline',
    });
    setIncoming(null);
  }, [incoming, localParticipant]);

  const forceTake = useCallback(async () => {
    if (!presenterIdentity || !isHost) return;
    await sendPresentMessage(localParticipant, presenterIdentity, {
      type: 'present:force-take',
    });
    pendingStartShare.current = true;
  }, [presenterIdentity, isHost, localParticipant]);

  const handleShareClick = useCallback(async () => {
    if (iAmPresenting) {
      await stopMyShare();
    } else if (!someoneElsePresenting) {
      await startMyShare();
    } else if (isHost) {
      await forceTake();
    } else {
      await requestPresentation();
    }
  }, [iAmPresenting, someoneElsePresenting, isHost, stopMyShare, startMyShare, forceTake, requestPresentation]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    };
  }, []);

  return {
    presenterIdentity,
    presenterName,
    // Non-null when the current share is agent-published (controllable).
    agentIdentity,
    iAmPresenting,
    someoneElsePresenting,
    outgoing,
    incoming,
    outcome,
    handleShareClick,
    cancelRequest,
    yieldPresentation,
    declinePresentation,
    dismissOutcome: () => setOutcome(null),
  };
}
