'use client';

import { useLocalParticipant, useRoomContext, useRoomInfo } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, isFaultError, type RemoteControlRequestSummary } from '@/lib/api';
import {
  REMOTE_CONTROL_TOPIC,
  decodeRemoteControlMessage,
  isControlAgentIdentity,
  isControlAgentParticipant,
  parseRemoteControlSession,
  sendRemoteControlMessage,
  type RemoteControlInputEvent,
} from '@/lib/controlProtocol';
import { emitFault } from '@/lib/faults';
import { getRemoteControlRequestRemainingMs } from '@/lib/remoteControlRequest';

export type RemoteControlNotice = {
  tone: 'info' | 'success' | 'error';
  message: string;
};

export type HelperBootstrap = {
  room: string;
  sessionId: string;
  code: string;
  expiresAt: string;
};

type Action = 'request' | 'approve' | 'deny' | 'stop' | 'renew' | 'reopen';

const NOTICE_MS = 5_000;
const REQUEST_RECOVERY_POLL_MS = 1_000;

function requestSummaryIsUsable(value: RemoteControlRequestSummary, room: string): boolean {
  return (
    value.room === room &&
    value.requestId.length > 0 &&
    value.requestId.length <= 160 &&
    value.sharerIdentity.length > 0 &&
    value.sharerIdentity.length <= 160 &&
    value.controllerIdentity.length > 0 &&
    value.controllerIdentity.length <= 160 &&
    value.sharerName.length > 0 &&
    value.sharerName.length <= 256 &&
    value.controllerName.length > 0 &&
    value.controllerName.length <= 256 &&
    getRemoteControlRequestRemainingMs(value) !== null
  );
}

function domainOutcome(code: string, action: Action): string | null {
  switch (code) {
    case 'REMOTE_CONTROL_IN_PROGRESS':
      return 'A Remote Control request or session is already active in this room.';
    case 'REMOTE_CONTROL_NOT_FOUND':
      return action === 'stop' ? 'That Remote Control session has already ended.' : 'That Remote Control request expired or was already handled.';
    case 'REMOTE_CONTROL_NOT_ALLOWED':
      return action === 'approve' || action === 'deny'
        ? 'Only the requested Sharer can respond to this Remote Control request.'
        : action === 'renew'
          ? 'Only the Sharer can reconfirm Remote Control.'
          : action === 'reopen'
            ? 'Only the Sharer can reopen the Control Agent.'
            : 'Only the Sharer or Controller can stop this Remote Control session.';
    case 'REMOTE_CONTROL_PRESENT_ACTIVE':
      return 'Remote Control cannot start while someone is presenting.';
    case 'REMOTE_CONTROL_RENEWAL_REQUIRED':
      return 'Remote Control expired because the Sharer did not reconfirm in time.';
    case 'REMOTE_CONTROL_HELPER_NOT_CONNECTED':
      return 'The Control Agent has not connected yet.';
    case 'NOT_PARTICIPANT':
      return 'Your in-call authorization expired. Leave and rejoin before trying again.';
    case 'ROOM_NOT_FOUND':
      return 'This room is no longer available.';
    default:
      return null;
  }
}

function clientSignalFault(message: string): void {
  emitFault({ code: 'REMOTE_CONTROL_SIGNAL_FAILED', message, statusCode: 0 });
}

export function useRemoteControl({ room, participantToken }: { room: string; participantToken: string }) {
  const lkRoom = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { metadata } = useRoomInfo();

  const session = useMemo(() => parseRemoteControlSession(metadata), [metadata]);
  const localIdentity = localParticipant.identity;
  const iAmSharer = !!session && session.sharerIdentity === localIdentity;
  const iAmController = !!session && session.controllerIdentity === localIdentity;

  const [incomingRequest, setIncomingRequest] = useState<RemoteControlRequestSummary | null>(null);
  const [outgoingRequest, setOutgoingRequest] = useState<RemoteControlRequestSummary | null>(null);
  const [helperBootstrap, setHelperBootstrap] = useState<HelperBootstrap | null>(null);
  const [notice, setNotice] = useState<RemoteControlNotice | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [requestingIdentity, setRequestingIdentity] = useState<string | null>(null);
  const [renewalOverride, setRenewalOverride] = useState<{ sessionId: string; renewalDueAt: string } | null>(null);
  const [pendingClipboardText, setPendingClipboardText] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verificationRef = useRef(0);
  const sequenceRef = useRef(0);
  const clipboardRevisionRef = useRef(0);

  const showNotice = useCallback((next: RemoteControlNotice) => {
    setNotice(next);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const handleActionError = useCallback(
    (error: unknown, action: Action) => {
      if (isFaultError(error)) {
        const tailored = domainOutcome(error.code, action);
        if (tailored) {
          showNotice({ tone: 'error', message: tailored });
        } else {
          emitFault(error.fault);
        }
        return;
      }
      emitFault({ code: 'REMOTE_CONTROL_CLIENT', message: 'Remote Control could not complete that action.', statusCode: 0 });
    },
    [showNotice],
  );

  const receiveClipboardUpdate = useCallback(
    (text: string, revision: number) => {
      if (revision <= clipboardRevisionRef.current) return;
      clipboardRevisionRef.current = revision;
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          if (revision !== clipboardRevisionRef.current) return;
          setPendingClipboardText(null);
          showNotice({ tone: 'success', message: 'Remote clipboard copied to this computer.' });
        } catch {
          if (revision !== clipboardRevisionRef.current) return;
          setPendingClipboardText(text);
          showNotice({ tone: 'info', message: 'Remote clipboard received. Select Copy received text to place it on this computer.' });
        }
      })();
    },
    [showNotice],
  );

  // A request notification is deliberately only a wake-up. Recover the request
  // from the participant-authorized API, then bind its Controller to LiveKit's
  // SFU-attested sender before displaying any identity or consent copy.
  useEffect(() => {
    let mounted = true;

    async function verifyRequest(requestId: string, sender: RemoteParticipant) {
      const verification = ++verificationRef.current;
      if (!localIdentity || session || isControlAgentParticipant(sender)) return;
      try {
        const recovered = await api.getRemoteControlRequest(room, requestId, participantToken);
        if (!mounted || verification !== verificationRef.current) return;
        if (
          !requestSummaryIsUsable(recovered, room) ||
          recovered.requestId !== requestId ||
          recovered.sharerIdentity !== localIdentity ||
          recovered.controllerIdentity !== sender.identity
        )
          return;
        setIncomingRequest(recovered);
      } catch {
        // Stale/forged notifications and passive recovery failures stay quiet.
        // httpFetch still updates the global API Reachability banner.
      }
    }

    function handleData(payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) {
      if (topic !== REMOTE_CONTROL_TOPIC || !participant) return;
      const message = decodeRemoteControlMessage(payload);
      if (!message) return;

      if (message.type === 'remote-control:request') {
        void verifyRequest(message.requestId, participant);
        return;
      }

      if (
        message.type === 'remote-control:denied' &&
        outgoingRequest &&
        message.requestId === outgoingRequest.requestId &&
        participant.identity === outgoingRequest.sharerIdentity
      ) {
        setOutgoingRequest(null);
        showNotice({ tone: 'error', message: `${outgoingRequest.sharerName} denied your Remote Control request.` });
        return;
      }

      if (
        message.type === 'remote-control:clipboard-update' &&
        session &&
        iAmController &&
        session.status === 'active' &&
        session.agentConnected &&
        message.sessionId === session.sessionId &&
        participant.identity === session.agentIdentity
      ) {
        receiveClipboardUpdate(message.text, message.revision);
      }
      // Input and Controller clipboard commands are consumed only by the native
      // Control Agent. Clipboard updates are accepted only from the active one.
    }

    lkRoom.on(RoomEvent.DataReceived, handleData);
    return () => {
      mounted = false;
      lkRoom.off(RoomEvent.DataReceived, handleData);
    };
  }, [iAmController, lkRoom, localIdentity, outgoingRequest, participantToken, receiveClipboardUpdate, room, session, showNotice]);

  // The addressed LiveKit message above remains the fast path. Polling only
  // while there is no Remote Control state gives the intended Sharer a bounded
  // recovery path if that wake-up packet was missed. The API exposes a request
  // only to the exact Sharer, so other joined browsers always receive null.
  useEffect(() => {
    if (!localIdentity || session || incomingRequest || outgoingRequest) return;
    let mounted = true;
    let recovering = false;

    const recoverPendingRequest = async () => {
      if (recovering) return;
      recovering = true;
      try {
        const { request } = await api.getPendingRemoteControlRequest(room, participantToken);
        if (!mounted || !request || !requestSummaryIsUsable(request, room) || request.sharerIdentity !== localIdentity) return;
        setIncomingRequest((current) => (current?.requestId === request.requestId ? current : request));
      } catch {
        // This is passive recovery. API Reachability owns any unavailable-server
        // indication, and the next poll or addressed packet can still recover.
      } finally {
        recovering = false;
      }
    };

    void recoverPendingRequest();
    const timer = setInterval(() => void recoverPendingRequest(), REQUEST_RECOVERY_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [incomingRequest, localIdentity, outgoingRequest, participantToken, room, session]);

  // Pending prompts are short-lived server records. Clear their local mirrors
  // after the API-calculated duration even if an addressed denial packet is lost.
  useEffect(() => {
    if (!incomingRequest) return;
    const timer = setTimeout(() => setIncomingRequest(null), getRemoteControlRequestRemainingMs(incomingRequest) ?? 0);
    return () => clearTimeout(timer);
  }, [incomingRequest]);

  useEffect(() => {
    if (!outgoingRequest) return;
    const timer = setTimeout(
      () => {
        setOutgoingRequest(null);
        showNotice({ tone: 'error', message: `${outgoingRequest.sharerName} did not respond before the request expired.` });
      },
      getRemoteControlRequestRemainingMs(outgoingRequest) ?? 0,
    );
    return () => clearTimeout(timer);
  }, [outgoingRequest, showNotice]);

  // Room metadata, not an approve packet, transitions the Controller into an
  // active session. It also resolves any local prompt after approval.
  useEffect(() => {
    if (!session) return;
    // The metadata transition is an external event; clear the stale consent
    // prompt synchronously so it cannot remain actionable after approval.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncomingRequest(null);
    if (outgoingRequest?.controllerIdentity === localIdentity && outgoingRequest.sharerIdentity === session.sharerIdentity) {
      setOutgoingRequest(null);
      showNotice({
        tone: 'success',
        message: session.agentConnected
          ? `You can now control ${session.sharerName}'s desktop.`
          : `Approved. Waiting for ${session.sharerName}'s Control Agent.`,
      });
    }
  }, [localIdentity, outgoingRequest, session, showNotice]);

  useEffect(() => {
    sequenceRef.current = 0;
    clipboardRevisionRef.current = 0;
    // Clipboard content is ephemeral to the active session and must not remain
    // available for a later Controller or a rejoined room.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingClipboardText(null);
  }, [session?.sessionId]);

  useEffect(() => {
    if (!helperBootstrap) return;
    if (!session || session.sessionId !== helperBootstrap.sessionId || session.agentConnected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHelperBootstrap(null);
    }
  }, [helperBootstrap, session]);

  useEffect(() => {
    if (!renewalOverride) return;
    if (!session || session.sessionId !== renewalOverride.sessionId || Date.parse(session.renewalDueAt) >= Date.parse(renewalOverride.renewalDueAt)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenewalOverride(null);
    }
  }, [renewalOverride, session]);

  const effectiveRenewalDueAt =
    renewalOverride && session && renewalOverride.sessionId === session.sessionId && Date.parse(renewalOverride.renewalDueAt) > Date.parse(session.renewalDueAt)
      ? renewalOverride.renewalDueAt
      : session?.renewalDueAt;

  useEffect(() => {
    if (!iAmSharer || !effectiveRenewalDueAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNow(0);
      return;
    }
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [effectiveRenewalDueAt, iAmSharer]);

  const renewalRemainingMs = iAmSharer && effectiveRenewalDueAt && now ? Math.max(0, Date.parse(effectiveRenewalDueAt) - now) : null;

  const requestControl = useCallback(
    async (sharerIdentity: string) => {
      if (!localIdentity || sharerIdentity === localIdentity || isControlAgentIdentity(sharerIdentity)) return;
      if (session || outgoingRequest) {
        showNotice({ tone: 'error', message: 'A Remote Control request or session is already in progress.' });
        return;
      }

      setBusy('request');
      setRequestingIdentity(sharerIdentity);
      try {
        const created = await api.requestRemoteControl(room, sharerIdentity, participantToken);
        if (!requestSummaryIsUsable(created, room) || created.controllerIdentity !== localIdentity || created.sharerIdentity !== sharerIdentity) {
          throw new Error('Invalid Remote Control request response');
        }
        setOutgoingRequest(created);
        try {
          await sendRemoteControlMessage(localParticipant, [created.sharerIdentity], {
            v: 1,
            type: 'remote-control:request',
            requestId: created.requestId,
          });
        } catch {
          clientSignalFault('The request was created, but the Sharer could not be notified. It will expire shortly.');
        }
      } catch (error) {
        handleActionError(error, 'request');
      } finally {
        setBusy(null);
        setRequestingIdentity(null);
      }
    },
    [handleActionError, localIdentity, localParticipant, outgoingRequest, participantToken, room, session, showNotice],
  );

  const approve = useCallback(async () => {
    if (!incomingRequest || incomingRequest.sharerIdentity !== localIdentity) return;
    setBusy('approve');
    try {
      const approved = await api.approveRemoteControl(room, incomingRequest.requestId, participantToken);
      if (
        approved.session.sharerIdentity !== localIdentity ||
        approved.session.controllerIdentity !== incomingRequest.controllerIdentity ||
        approved.session.sessionId.length === 0 ||
        approved.helper.bootstrapCode.length === 0
      )
        throw new Error('Invalid Remote Control approval response');

      setIncomingRequest(null);
      setHelperBootstrap({
        room,
        sessionId: approved.session.sessionId,
        code: approved.helper.bootstrapCode,
        expiresAt: approved.helper.expiresAt,
      });
    } catch (error) {
      if (isFaultError(error) && error.code === 'REMOTE_CONTROL_NOT_FOUND') setIncomingRequest(null);
      handleActionError(error, 'approve');
    } finally {
      setBusy(null);
    }
  }, [handleActionError, incomingRequest, localIdentity, participantToken, room]);

  const reopenAgent = useCallback(async (): Promise<HelperBootstrap | null> => {
    if (!session || !iAmSharer || session.agentConnected) return null;
    setBusy('reopen');
    try {
      const fresh = await api.reissueRemoteControlBootstrap(room, session.sessionId, participantToken);
      if (!fresh.bootstrapCode || !Number.isFinite(Date.parse(fresh.expiresAt))) throw new Error('Invalid Control Agent bootstrap response');
      const next = { room, sessionId: session.sessionId, code: fresh.bootstrapCode, expiresAt: fresh.expiresAt };
      setHelperBootstrap(next);
      return next;
    } catch (error) {
      handleActionError(error, 'reopen');
      return null;
    } finally {
      setBusy(null);
    }
  }, [handleActionError, iAmSharer, participantToken, room, session]);

  const deny = useCallback(async () => {
    if (!incomingRequest || incomingRequest.sharerIdentity !== localIdentity) return;
    const denied = incomingRequest;
    setBusy('deny');
    try {
      await api.denyRemoteControl(room, denied.requestId, participantToken);
      setIncomingRequest(null);
      try {
        await sendRemoteControlMessage(localParticipant, [denied.controllerIdentity], {
          v: 1,
          type: 'remote-control:denied',
          requestId: denied.requestId,
        });
      } catch {
        clientSignalFault('The request was denied, but the Controller could not be notified.');
      }
    } catch (error) {
      if (isFaultError(error) && error.code === 'REMOTE_CONTROL_NOT_FOUND') setIncomingRequest(null);
      handleActionError(error, 'deny');
    } finally {
      setBusy(null);
    }
  }, [handleActionError, incomingRequest, localIdentity, localParticipant, participantToken, room]);

  const stop = useCallback(async () => {
    if (!session || (!iAmSharer && !iAmController)) return;
    setBusy('stop');
    try {
      await api.stopRemoteControl(room, session.sessionId, participantToken);
      setHelperBootstrap(null);
      showNotice({ tone: 'info', message: 'Remote Control ended.' });
    } catch (error) {
      handleActionError(error, 'stop');
    } finally {
      setBusy(null);
    }
  }, [handleActionError, iAmController, iAmSharer, participantToken, room, session, showNotice]);

  const renew = useCallback(async () => {
    if (!session || !iAmSharer) return;
    setBusy('renew');
    try {
      const renewed = await api.renewRemoteControl(room, session.sessionId, participantToken);
      if (renewed.sessionId !== session.sessionId || !Number.isFinite(Date.parse(renewed.renewalDueAt))) throw new Error('Invalid renewal response');
      setRenewalOverride(renewed);
      setNow(Date.now());
      showNotice({ tone: 'success', message: 'Remote Control reconfirmed for another 30 minutes.' });
    } catch (error) {
      handleActionError(error, 'renew');
    } finally {
      setBusy(null);
    }
  }, [handleActionError, iAmSharer, participantToken, room, session, showNotice]);

  const sendInput = useCallback(
    (event: RemoteControlInputEvent) => {
      if (!session || !iAmController || session.status !== 'active' || !session.agentConnected) return;
      const sequence = ++sequenceRef.current;
      void sendRemoteControlMessage(localParticipant, [session.agentIdentity], {
        v: 1,
        type: 'remote-control:input',
        sessionId: session.sessionId,
        sequence,
        event,
      }).catch(() => {
        // Input transport is ephemeral. Lifecycle metadata/connection UI owns
        // persistent failure state; never log the input payload.
      });
    },
    [iAmController, localParticipant, session],
  );

  const sendClipboardCopy = useCallback(() => {
    if (!session || !iAmController || session.status !== 'active' || !session.agentConnected) return;
    try {
      const sequence = ++sequenceRef.current;
      void sendRemoteControlMessage(localParticipant, [session.agentIdentity], {
        v: 1,
        type: 'remote-control:clipboard-copy',
        sessionId: session.sessionId,
        sequence,
      }).catch(() => showNotice({ tone: 'error', message: 'Remote copy could not be sent. Try again.' }));
    } catch {
      showNotice({ tone: 'error', message: 'Remote copy could not be sent. Try again.' });
    }
  }, [iAmController, localParticipant, session, showNotice]);

  const pasteClipboard = useCallback(() => {
    if (!session || !iAmController || session.status !== 'active' || !session.agentConnected) return;
    void (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) {
          showNotice({ tone: 'info', message: 'Your clipboard has no plain text to paste remotely.' });
          return;
        }
        const sequence = ++sequenceRef.current;
        await sendRemoteControlMessage(localParticipant, [session.agentIdentity], {
          v: 1,
          type: 'remote-control:clipboard-paste',
          sessionId: session.sessionId,
          sequence,
          text,
        });
      } catch (error) {
        if (error instanceof RangeError) {
          showNotice({ tone: 'error', message: 'That clipboard text is too large to transfer.' });
          return;
        }
        showNotice({ tone: 'error', message: 'Huddle could not read your clipboard. Allow clipboard access, then try Paste again.' });
      }
    })();
  }, [iAmController, localParticipant, session, showNotice]);

  const copyReceivedClipboard = useCallback(async () => {
    if (!pendingClipboardText) return;
    try {
      await navigator.clipboard.writeText(pendingClipboardText);
      setPendingClipboardText((current) => (current === pendingClipboardText ? null : current));
      showNotice({ tone: 'success', message: 'Remote clipboard copied to this computer.' });
    } catch {
      showNotice({ tone: 'error', message: 'Huddle could not write to your clipboard. Allow clipboard access, then try again.' });
    }
  }, [pendingClipboardText, showNotice]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  return {
    session,
    localIdentity,
    iAmSharer,
    iAmController,
    incomingRequest,
    outgoingRequest,
    helperBootstrap,
    notice,
    busy,
    requestingIdentity,
    renewalRemainingMs,
    pendingClipboardText,
    requestControl,
    approve,
    reopenAgent,
    deny,
    stop,
    renew,
    sendInput,
    sendClipboardCopy,
    pasteClipboard,
    copyReceivedClipboard,
    dismissNotice: () => setNotice(null),
    dismissHelperBootstrap: () => setHelperBootstrap(null),
  };
}
