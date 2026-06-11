'use client';

import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTROL_TOPIC, agentIdentityFor, decodeControl, sendControlMessage, type ControlInputEvent } from '@/lib/controlProtocol';

// Remote Control session state machine (docs/adr/0010). Mirrors the
// usePresentation patterns: data messages on a topic, initiator-side timeouts,
// transient outcome toasts. Consent rules: only the Presenter grants, exactly
// one Controller at a time, no host bypass (there is no force message at all).

export type ControlRequest = { requesterId: string; requesterName: string };
export type ControlOffer = { presenterIdentity: string; presenterName: string };
export type Controlling = { presenterIdentity: string; presenterName: string; agentIdentity: string };

export type ControlOutcome =
  | { kind: 'request-declined'; name: string }
  | { kind: 'request-timed-out'; name: string }
  | { kind: 'offer-declined'; name: string }
  | { kind: 'offer-timed-out'; name: string }
  | { kind: 'revoked'; name: string }
  | { kind: 'released'; name: string };

const REQUEST_TIMEOUT_MS = 30_000;
const OUTCOME_DISPLAY_MS = 4_000;

export function useRemoteControl({
  presenterIdentity,
  presenterName,
  iAmPresenting,
  agentIdentity,
}: {
  presenterIdentity: string | null;
  presenterName: string | null;
  iAmPresenting: boolean;
  agentIdentity: string | null;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const controllable = agentIdentity !== null;
  // True when the controllable share is mine (so I'm the one who grants).
  const iAmControllablePresenter = controllable && iAmPresenting;

  // --- Presenter-side state ---
  const [incomingRequest, setIncomingRequest] = useState<ControlRequest | null>(null);
  const [outgoingOffer, setOutgoingOffer] = useState<ControlRequest | null>(null);
  const [controller, setController] = useState<ControlRequest | null>(null);

  // --- Viewer-side state ---
  const [outgoingRequest, setOutgoingRequest] = useState<ControlOffer | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<ControlOffer | null>(null);
  const [controlling, setControlling] = useState<Controlling | null>(null);

  const [outcome, setOutcome] = useState<ControlOutcome | null>(null);
  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showOutcome(o: ControlOutcome) {
    setOutcome(o);
    if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    outcomeTimerRef.current = setTimeout(() => setOutcome(null), OUTCOME_DISPLAY_MS);
  }

  function clearOutgoingRequest() {
    setOutgoingRequest(null);
    if (requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
  }

  function clearOutgoingOffer() {
    setOutgoingOffer(null);
    if (offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }
  }

  // A new grant supersedes the previous controller: revoke them first so
  // their UI clears, then tell the agent + new controller.
  const doGrant = useCallback(
    async (target: ControlRequest) => {
      if (!agentIdentity) return;
      if (controller && controller.requesterId !== target.requesterId) {
        await sendControlMessage(localParticipant, [controller.requesterId], { v: 1, type: 'control:revoke' });
      }
      await sendControlMessage(localParticipant, [agentIdentity, target.requesterId], {
        v: 1,
        type: 'control:grant',
        controllerId: target.requesterId,
        controllerName: target.requesterName,
      });
      setController(target);
    },
    [agentIdentity, controller, localParticipant],
  );

  // Listen for incoming control messages.
  useEffect(() => {
    function handleData(payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) {
      if (topic !== CONTROL_TOPIC || !participant) return;
      const msg = decodeControl(payload);
      if (!msg) return;
      const sender = participant.identity;

      switch (msg.type) {
        case 'control:request':
          if (iAmControllablePresenter) {
            setIncomingRequest({ requesterId: msg.requesterId, requesterName: msg.requesterName });
          }
          break;

        case 'control:offer':
          // Only the current Presenter may offer, and only for a controllable share.
          if (controllable && !iAmPresenting && sender === presenterIdentity) {
            setIncomingOffer({ presenterIdentity: sender, presenterName: presenterName || sender });
          }
          break;

        case 'control:accept':
          if (outgoingOffer && sender === outgoingOffer.requesterId) {
            clearOutgoingOffer();
            void doGrant(outgoingOffer);
          }
          break;

        case 'control:decline':
          if (outgoingRequest && sender === outgoingRequest.presenterIdentity) {
            showOutcome({ kind: 'request-declined', name: outgoingRequest.presenterName });
            clearOutgoingRequest();
          }
          if (outgoingOffer && sender === outgoingOffer.requesterId) {
            showOutcome({ kind: 'offer-declined', name: outgoingOffer.requesterName });
            clearOutgoingOffer();
          }
          if (iAmControllablePresenter && incomingRequest && sender === incomingRequest.requesterId) {
            // Requester withdrew before we decided.
            setIncomingRequest(null);
          }
          break;

        case 'control:grant':
          // Only the Presenter's grant naming me makes me the Controller.
          if (sender === presenterIdentity && msg.controllerId === localParticipant.identity) {
            clearOutgoingRequest();
            setIncomingOffer(null);
            setControlling({
              presenterIdentity: sender,
              presenterName: presenterName || sender,
              agentIdentity: agentIdentityFor(sender),
            });
          }
          break;

        case 'control:revoke':
          if (controlling && sender === controlling.presenterIdentity) {
            showOutcome({ kind: 'revoked', name: controlling.presenterName });
            setControlling(null);
          }
          break;

        case 'control:release':
          if (controller && sender === controller.requesterId) {
            showOutcome({ kind: 'released', name: controller.requesterName });
            setController(null);
          }
          break;

        case 'control:clipboard':
          // Agent → controller leg of the session clipboard sync. Best-effort:
          // the write fails silently if the document lost focus or permission.
          if (controlling && sender === controlling.agentIdentity) {
            void navigator.clipboard?.writeText(msg.text).catch(() => {});
          }
          break;
      }
    }

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [
    room,
    localParticipant,
    iAmPresenting,
    iAmControllablePresenter,
    controllable,
    presenterIdentity,
    presenterName,
    incomingRequest,
    outgoingRequest,
    outgoingOffer,
    controller,
    controlling,
    doGrant,
  ]);

  // Control exists only inside the controllable presentation: when the share
  // ends or the agent changes (new presenter), every session artifact dies
  // with it. State resets happen as a render-time adjustment; the pending
  // timers are cleared in the companion effect below (render must not touch
  // refs). A timer that fires before that cleanup no-ops against null state.
  const [prevAgentIdentity, setPrevAgentIdentity] = useState(agentIdentity);
  if (prevAgentIdentity !== agentIdentity) {
    setPrevAgentIdentity(agentIdentity);
    setIncomingRequest(null);
    setIncomingOffer(null);
    setController(null);
    setControlling(null);
    setOutgoingRequest(null);
    setOutgoingOffer(null);
  }

  useEffect(() => {
    return () => {
      if (requestTimerRef.current) {
        clearTimeout(requestTimerRef.current);
        requestTimerRef.current = null;
      }
      if (offerTimerRef.current) {
        clearTimeout(offerTimerRef.current);
        offerTimerRef.current = null;
      }
    };
  }, [agentIdentity]);

  // Clean up when a counterpart disconnects mid-flow.
  useEffect(() => {
    function handleDisconnect(participant: RemoteParticipant) {
      const id = participant.identity;
      setIncomingRequest((r) => (r?.requesterId === id ? null : r));
      setController((c) => (c?.requesterId === id ? null : c));
      setOutgoingOffer((o) => (o?.requesterId === id ? null : o));
      setIncomingOffer((o) => (o?.presenterIdentity === id ? null : o));
    }
    room.on(RoomEvent.ParticipantDisconnected, handleDisconnect);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, handleDisconnect);
    };
  }, [room]);

  // --- Viewer actions ---

  const requestControl = useCallback(async () => {
    if (!controllable || iAmPresenting || !presenterIdentity || controlling) return;
    await sendControlMessage(localParticipant, [presenterIdentity], {
      v: 1,
      type: 'control:request',
      requesterId: localParticipant.identity,
      requesterName: localParticipant.name || localParticipant.identity,
    });
    setOutgoingRequest({ presenterIdentity, presenterName: presenterName || presenterIdentity });
    requestTimerRef.current = setTimeout(() => {
      setOutgoingRequest((prev) => {
        if (prev) showOutcome({ kind: 'request-timed-out', name: prev.presenterName });
        return null;
      });
      requestTimerRef.current = null;
    }, REQUEST_TIMEOUT_MS);
  }, [controllable, iAmPresenting, presenterIdentity, presenterName, controlling, localParticipant]);

  const cancelRequest = useCallback(async () => {
    if (outgoingRequest) {
      // Tell the presenter so their prompt clears too.
      await sendControlMessage(localParticipant, [outgoingRequest.presenterIdentity], { v: 1, type: 'control:decline' });
    }
    clearOutgoingRequest();
  }, [outgoingRequest, localParticipant]);

  const acceptOffer = useCallback(async () => {
    if (!incomingOffer) return;
    await sendControlMessage(localParticipant, [incomingOffer.presenterIdentity], { v: 1, type: 'control:accept' });
    setIncomingOffer(null);
    // The grant follows from the presenter; nothing to show until it lands.
  }, [incomingOffer, localParticipant]);

  const declineOffer = useCallback(async () => {
    if (!incomingOffer) return;
    await sendControlMessage(localParticipant, [incomingOffer.presenterIdentity], { v: 1, type: 'control:decline' });
    setIncomingOffer(null);
  }, [incomingOffer, localParticipant]);

  const release = useCallback(async () => {
    if (!controlling) return;
    await sendControlMessage(localParticipant, [controlling.agentIdentity, controlling.presenterIdentity], { v: 1, type: 'control:release' });
    setControlling(null);
  }, [controlling, localParticipant]);

  // --- Presenter actions ---

  const grantRequest = useCallback(async () => {
    if (!incomingRequest) return;
    setIncomingRequest(null);
    await doGrant(incomingRequest);
  }, [incomingRequest, doGrant]);

  const declineRequest = useCallback(async () => {
    if (!incomingRequest) return;
    await sendControlMessage(localParticipant, [incomingRequest.requesterId], { v: 1, type: 'control:decline' });
    setIncomingRequest(null);
  }, [incomingRequest, localParticipant]);

  const offerControl = useCallback(
    async (targetId: string, targetName: string) => {
      if (!iAmControllablePresenter) return;
      await sendControlMessage(localParticipant, [targetId], { v: 1, type: 'control:offer' });
      setOutgoingOffer({ requesterId: targetId, requesterName: targetName });
      offerTimerRef.current = setTimeout(() => {
        setOutgoingOffer((prev) => {
          if (prev) showOutcome({ kind: 'offer-timed-out', name: prev.requesterName });
          return null;
        });
        offerTimerRef.current = null;
      }, REQUEST_TIMEOUT_MS);
    },
    [iAmControllablePresenter, localParticipant],
  );

  const revoke = useCallback(async () => {
    if (!controller || !agentIdentity) return;
    await sendControlMessage(localParticipant, [agentIdentity, controller.requesterId], { v: 1, type: 'control:revoke' });
    setController(null);
  }, [controller, agentIdentity, localParticipant]);

  // --- Controller transport (used by the input-capture surface) ---

  const sendInput = useCallback(
    (event: ControlInputEvent) => {
      if (!controlling) return;
      void sendControlMessage(localParticipant, [controlling.agentIdentity], { v: 1, type: 'control:input', event });
    },
    [controlling, localParticipant],
  );

  const sendClipboard = useCallback(
    (text: string) => {
      if (!controlling) return;
      void sendControlMessage(localParticipant, [controlling.agentIdentity], { v: 1, type: 'control:clipboard', text });
    },
    [controlling, localParticipant],
  );

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    };
  }, []);

  return {
    controllable,
    iAmControllablePresenter,
    // presenter side
    incomingRequest,
    outgoingOffer,
    controller,
    grantRequest,
    declineRequest,
    offerControl,
    revoke,
    // viewer side
    outgoingRequest,
    incomingOffer,
    controlling,
    requestControl,
    cancelRequest,
    acceptOffer,
    declineOffer,
    release,
    // transport
    sendInput,
    sendClipboard,
    // toasts
    outcome,
    dismissOutcome: () => setOutcome(null),
  };
}
