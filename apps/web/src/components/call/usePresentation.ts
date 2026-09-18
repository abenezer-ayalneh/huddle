'use client';

import { isTrackReference, useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { RoomEvent, Track, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PRESENT_TOPIC, decode, sendPresentMessage } from '@/lib/presentProtocol';
import { isControlAgentParticipant } from '@/lib/controlProtocol';
import type { PresentationDisplaySurface } from './pictureInPicture.types';

export type OutgoingRequest = {
  requestId: string;
  presenterIdentity: string;
  presenterName: string;
};

export type IncomingRequest = {
  requestId: string;
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

export function usePresentation(isHost: boolean, remoteControlActive = false) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  // The Control Agent's desktop track is a Remote Control stage, not a normal
  // Present. It must never enter Ask to Present's client-side state machine.
  const presenterTrack = screenTracks.find((track) => !isControlAgentParticipant(track.participant)) ?? null;
  const presenterIdentity = presenterTrack?.participant.identity ?? null;
  const presenterName = presenterTrack?.participant.name || presenterIdentity;
  const rawIAmPresenting = presenterIdentity === localParticipant.identity;
  const someoneElsePresenting = presenterIdentity !== null && !rawIAmPresenting;
  const displaySurface: PresentationDisplaySurface | null = (() => {
    if (!presenterTrack || !isTrackReference(presenterTrack)) return null;
    const value = presenterTrack.publication.track?.mediaStreamTrack.getSettings().displaySurface;
    return value === 'window' || value === 'monitor' || value === 'browser' ? value : 'unknown';
  })();

  const [outgoing, setOutgoing] = useState<OutgoingRequest | null>(null);
  const [incoming, setIncoming] = useState<IncomingRequest | null>(null);
  const [outcome, setOutcome] = useState<PresentationOutcome | null>(null);
  const [autoStartTick, setAutoStartTick] = useState(0);
  const autoStartConsumedRef = useRef(0);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStartShare = useRef(false);
  const [stoppingPresentation, setStoppingPresentation] = useState(false);
  const presentationRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const localPresentationRef = useRef(rawIAmPresenting);

  useEffect(() => {
    localPresentationRef.current = rawIAmPresenting;
  }, [rawIAmPresenting]);

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
    await localParticipant.setScreenShareEnabled(false);
  }, [localParticipant]);

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
          if (rawIAmPresenting) {
            setIncoming({
              requestId: msg.requestId,
              requesterId: msg.requesterId,
              requesterName: msg.requesterName,
            });
          }
          break;

        case 'present:cancel':
          setIncoming((current) => (current?.requestId === msg.requestId && current.requesterId === msg.requesterId ? null : current));
          break;

        case 'present:yield':
          if (outgoing && outgoing.requestId === msg.requestId) {
            clearOutgoing();
            showOutcome({
              kind: 'yielded',
              name: outgoing.presenterName,
            });
            pendingStartShare.current = true;
          }
          break;

        case 'present:decline':
          if (outgoing && outgoing.requestId === msg.requestId) {
            showOutcome({
              kind: 'declined',
              name: outgoing.presenterName,
            });
            clearOutgoing();
          }
          break;

        case 'present:force-take':
          if (rawIAmPresenting) {
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
  }, [room, rawIAmPresenting, outgoing, stopMyShare]);

  // Stop is optimistic: presenting surfaces disappear immediately. Failed
  // unpublishes are reconciled quietly because browser/OS indicators remain
  // authoritative while the track is still live.
  const stopMyShareOptimistically = useCallback(async () => {
    if (!rawIAmPresenting || stoppingPresentation) return;
    setStoppingPresentation(true);
    const deadline = Date.now() + 10_000;
    let pause = 250;
    while (!unmountedRef.current && Date.now() < deadline) {
      try {
        await localParticipant.setScreenShareEnabled(false);
        return;
      } catch {
        await new Promise<void>((resolve) => window.setTimeout(resolve, pause));
        pause = Math.min(pause * 2, 2_000);
      }
    }
    const reconcile = async () => {
      if (unmountedRef.current || !localPresentationRef.current) return;
      try {
        await localParticipant.setScreenShareEnabled(false);
      } finally {
        if (!unmountedRef.current) presentationRetryRef.current = setTimeout(reconcile, 30_000);
      }
    };
    presentationRetryRef.current = setTimeout(reconcile, 30_000);
  }, [localParticipant, rawIAmPresenting, stoppingPresentation]);

  useEffect(() => {
    if (!rawIAmPresenting && stoppingPresentation) setStoppingPresentation(false);
  }, [rawIAmPresenting, stoppingPresentation]);

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
    if (!presenterIdentity || rawIAmPresenting) return;

    const requestId = crypto.randomUUID();
    await sendPresentMessage(localParticipant, presenterIdentity, {
      type: 'present:request',
      requestId,
      requesterId: localParticipant.identity,
      requesterName: localParticipant.name || localParticipant.identity,
    });

    setOutgoing({
      requestId,
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
  }, [presenterIdentity, presenterName, rawIAmPresenting, localParticipant]);

  const cancelRequest = useCallback(() => {
    const cancelled = outgoing;
    clearOutgoing();
    if (cancelled) {
      void sendPresentMessage(localParticipant, cancelled.presenterIdentity, {
        type: 'present:cancel',
        requestId: cancelled.requestId,
        requesterId: localParticipant.identity,
      }).catch(() => undefined);
    }
  }, [localParticipant, outgoing]);

  const yieldPresentation = useCallback(async () => {
    if (!incoming) return;
    await sendPresentMessage(localParticipant, incoming.requesterId, {
      type: 'present:yield',
      requestId: incoming.requestId,
    });
    setIncoming(null);
    await stopMyShare();
  }, [incoming, localParticipant, stopMyShare]);

  const declinePresentation = useCallback(async () => {
    if (!incoming) return;
    await sendPresentMessage(localParticipant, incoming.requesterId, {
      type: 'present:decline',
      requestId: incoming.requestId,
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
    if (remoteControlActive) return;
    if (rawIAmPresenting) {
      await stopMyShareOptimistically();
    } else if (!someoneElsePresenting) {
      await startMyShare();
    } else if (isHost) {
      await forceTake();
    } else {
      await requestPresentation();
    }
  }, [rawIAmPresenting, someoneElsePresenting, isHost, stopMyShareOptimistically, startMyShare, forceTake, requestPresentation, remoteControlActive]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
      if (presentationRetryRef.current) clearTimeout(presentationRetryRef.current);
      unmountedRef.current = true;
    };
  }, []);

  return {
    presenterIdentity,
    presenterName,
    displaySurface,
    iAmPresenting: rawIAmPresenting && !stoppingPresentation,
    stopping: stoppingPresentation,
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
