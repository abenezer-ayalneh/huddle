'use client';

import { LiveKitRoom, RoomAudioRenderer, useChat, type LocalUserChoices, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useBackgroundCall } from '@/components/call/useBackgroundCall';
import { usePictureInPicture } from '@/components/call/usePictureInPicture';
import AgentLaunchDialog from '@/components/call/AgentLaunchDialog';
import ChatPanel from '@/components/call/ChatPanel';
import ConnectionStatus from '@/components/call/ConnectionStatus';
import CallTimer from '@/components/call/CallTimer';
import ControlBar from '@/components/call/ControlBar';
import PresentationToast from '@/components/call/PresentationToast';
import PreJoinScreen from '@/components/call/PreJoinScreen';
import RecordingIndicator from '@/components/call/RecordingIndicator';
import RecordingToast from '@/components/call/RecordingToast';
import RemoteControlBanner from '@/components/call/RemoteControlBanner';
import RemoteControlSurface from '@/components/call/RemoteControlSurface';
import RemoteControlToast from '@/components/call/RemoteControlToast';
import VideoGrid from '@/components/call/VideoGrid';
import ErrorBoundary from '@/components/faults/ErrorBoundary';
import { usePresentation } from '@/components/call/usePresentation';
import { useRecording } from '@/components/call/useRecording';
import { useRemoteControl } from '@/components/call/useRemoteControl';
import { api, API_URL } from '@/lib/api';
import LeaveConfirmDialog from './LeaveConfirmDialog';
import { Centered } from './ui';

type Connection = { token: string; livekitUrl: string };

// Static capability — nothing to subscribe to.
const emptySubscribe = () => () => {};

export default function CallStage({
  room,
  connection,
  displayName,
  onLeave,
  onError,
  overlay,
  initialChoices,
  startMuted = false,
  isHost = false,
  hostKey,
}: {
  room: string;
  connection: Connection;
  displayName: string;
  onLeave: () => void;
  onError: (message: string) => void;
  overlay?: ReactNode;
  initialChoices?: LocalUserChoices;
  startMuted?: boolean;
  isHost?: boolean;
  // Present only for the host; lets them approve a Request to Record.
  hostKey?: string;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(initialChoices ?? null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
    onLeave();
  }, [onLeave]);

  // Back-gesture intercept (Android OS back button / Safari swipe): once in the
  // call, trap the history pop and surface the Leave confirmation instead of
  // navigating away. Converting the pop into an in-app decision also keeps the
  // page mounted so leaving tears the connection down exactly once — no
  // bfcache-frozen page that reconnects into a "ghost" duplicate on return.
  useEffect(() => {
    if (!choices) return;
    window.history.pushState({ huddleCall: true }, '');
    function onPopState() {
      setShowLeaveDialog(true);
      // Re-arm so a second back press is trapped too.
      window.history.pushState({ huddleCall: true }, '');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [choices]);

  if (!choices) {
    return (
      <PreJoinScreen
        defaults={{
          username: displayName,
          videoEnabled: true,
          audioEnabled: true,
        }}
        onSubmit={setChoices}
        onError={(e) => onError(`Couldn't access your camera or microphone: ${e.message}. Check browser permissions and try again.`)}
        heading="Ready to join?"
        subheading="Check your camera and mic before you go live."
        submitLabel="Join call"
      />
    );
  }

  return (
    <main className="relative flex-1">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.livekitUrl}
        connect
        video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
        audio={startMuted || !choices.audioEnabled ? false : { deviceId: choices.audioDeviceId }}
        onDisconnected={onLeave}
        onError={(e) => onError(`Lost connection to the call: ${e.message}`)}
        style={{ height: '100dvh' }}
        className="bg-dotgrid"
      >
        <CallView
          room={room}
          token={connection.token}
          displayName={displayName}
          onLeaveClick={() => setShowLeaveDialog(true)}
          overlay={overlay}
          isHost={isHost}
          hostKey={hostKey}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      <LeaveConfirmDialog open={showLeaveDialog} onConfirm={confirmLeave} onCancel={() => setShowLeaveDialog(false)} />
    </main>
  );
}

function CallView({
  room,
  token,
  displayName,
  onLeaveClick,
  overlay,
  isHost,
  hostKey,
}: {
  room: string;
  token: string;
  displayName: string;
  onLeaveClick: () => void;
  overlay?: ReactNode;
  isHost: boolean;
  hostKey?: string;
}) {
  const { chatMessages, send, isSending } = useChat();
  const [chatOpen, setChatOpen] = useState(false);

  // Background Call + Picture-in-Picture. VideoGrid reports the feed that owns
  // the main stage; PiP mirrors it into the OS floating window, and the
  // background hook keeps the call alive (mic on, camera off) when the app is
  // backgrounded on mobile, auto-entering PiP where the browser allows it.
  const [stageTrack, setStageTrack] = useState<TrackReferenceOrPlaceholder | null>(null);
  const { videoRef: pipVideoRef, enter: enterPip, exit: exitPip, active: pipActive, supported: pipSupported } = usePictureInPicture(stageTrack);
  useBackgroundCall({ enterPip });

  const presentation = usePresentation(isHost);
  const recording = useRecording({ room, token, isHost, hostKey });

  // The non-host record affordance walks request → wait → stop (approval starts
  // the recording immediately). The host records from the Host panel, and nobody
  // but the active recorder gets a stop button, so the control-bar button is
  // hidden in those cases (the room-wide RecordingIndicator still shows state).
  const recordMode: 'request' | 'pending' | 'recording' | undefined = isHost
    ? undefined
    : recording.iAmRecorder
      ? 'recording'
      : recording.recordingActive
        ? undefined
        : recording.phase === 'pending'
          ? 'pending'
          : 'request';

  const onRecordClick = recordMode === 'recording' ? recording.stopRecording : recordMode === 'pending' ? recording.cancelRequest : recording.requestToRecord;
  const control = useRemoteControl({
    presenterIdentity: presentation.presenterIdentity,
    presenterName: presentation.presenterName,
    iAmPresenting: presentation.iAmPresenting,
    agentIdentity: presentation.agentIdentity,
  });

  // Present with Control entry point. Desktop browsers only — gated on
  // getDisplayMedia as a coarse "this is a desktop" check (the agent itself
  // captures, but a phone can't run the desktop agent next to it). Read via
  // useSyncExternalStore so SSR renders false without a hydration mismatch.
  const canPresentWithControl = useSyncExternalStore(
    emptySubscribe,
    () => !!navigator.mediaDevices?.getDisplayMedia,
    () => false,
  );

  const [launchCode, setLaunchCode] = useState<string | null>(null);
  const presentWithControl = useCallback(async () => {
    try {
      const { code } = await api.controlAgentLink(room, token);
      setLaunchCode(code);
      // Hand the one-time code to the agent via deep link. Launched from a
      // hidden iframe — assigning location.href to an unhandled custom scheme
      // unloads the page (disconnecting the call!); an iframe contains the
      // failure. The dialog stays up as the no-handler fallback either way.
      const frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.src = `huddle://present?code=${encodeURIComponent(code)}&api=${encodeURIComponent(API_URL)}`;
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 3000);
    } catch {
      setLaunchCode(null);
    }
  }, [room, token]);

  // The agent joined and its share is up — the launch dialog has done its
  // job. Render-time adjustment, same pattern as the unread counter below.
  if (launchCode !== null && presentation.agentIdentity && presentation.iAmPresenting) {
    setLaunchCode(null);
  }

  const [unread, setUnread] = useState(0);
  const [prev, setPrev] = useState({
    len: chatMessages.length,
    open: chatOpen,
  });
  if (prev.len !== chatMessages.length || prev.open !== chatOpen) {
    if (chatOpen) {
      setUnread(0);
    } else {
      const delta = chatMessages.length - prev.len;
      if (delta > 0) setUnread((u) => u + delta);
    }
    setPrev({ len: chatMessages.length, open: chatOpen });
  }

  return (
    <>
      <VideoGrid
        presentationOverlay={control.controlling ? <RemoteControlSurface sendInput={control.sendInput} sendClipboard={control.sendClipboard} /> : undefined}
        iAmPresenting={presentation.iAmPresenting}
        onStopPresenting={presentation.handleShareClick}
        onStageTrackChange={setStageTrack}
        localName={displayName}
      />
      {/* Scoped boundaries (docs/adr/0018): the chat and the data-message-driven
          overlays are the likely crash sources. A crash in any of them fails to
          nothing and is logged — it must never unmount <LiveKitRoom> and drop the
          participant from the call. */}
      <ErrorBoundary label="Chat" fallback={null}>
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} messages={chatMessages} onSend={send} isSending={isSending} />
      </ErrorBoundary>
      <ControlBar
        onLeave={onLeaveClick}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        unreadChat={unread}
        iAmPresenting={presentation.iAmPresenting}
        someoneElsePresenting={presentation.someoneElsePresenting}
        onShareClick={presentation.handleShareClick}
        onPresentWithControl={canPresentWithControl ? presentWithControl : undefined}
        hasOutgoingRequest={!!presentation.outgoing}
        recordMode={recordMode}
        onRecordClick={recordMode ? onRecordClick : undefined}
        recordBusy={recording.busy}
        suspendShortcuts={!!control.controlling}
        onPopOut={pipSupported ? () => (pipActive ? exitPip() : enterPip()) : undefined}
        pipActive={pipActive}
      />
      <ErrorBoundary label="Remote control banner" fallback={null}>
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center">
          <RemoteControlBanner
            iAmControllablePresenter={control.iAmControllablePresenter}
            controller={control.controller}
            controlling={control.controlling}
            canRequest={control.controllable && !presentation.iAmPresenting && !control.controlling && !control.outgoingRequest && !control.incomingOffer}
            onRequest={control.requestControl}
            onRevoke={control.revoke}
            onRelease={control.release}
            onOffer={control.offerControl}
          />
        </div>
      </ErrorBoundary>
      <ErrorBoundary label="Call toasts" fallback={null}>
        <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex flex-col items-center gap-2">
          <RecordingIndicator active={recording.recordingActive} startedAt={recording.recordingStartedAt} />
          <RecordingToast
            incoming={recording.incoming}
            pending={recording.phase === 'pending'}
            outcome={recording.outcome}
            onApprove={recording.approve}
            onDeny={recording.deny}
            onCancel={recording.cancelRequest}
            onDismissOutcome={recording.dismissOutcome}
          />
          <PresentationToast
            outgoing={presentation.outgoing}
            incoming={presentation.incoming}
            outcome={presentation.outcome}
            onCancel={presentation.cancelRequest}
            onYield={presentation.yieldPresentation}
            onDecline={presentation.declinePresentation}
            onDismissOutcome={presentation.dismissOutcome}
          />
          <RemoteControlToast
            incomingRequest={control.incomingRequest}
            incomingOffer={control.incomingOffer}
            outgoingRequest={control.outgoingRequest}
            outgoingOffer={control.outgoingOffer}
            outcome={control.outcome}
            onGrant={control.grantRequest}
            onDeclineRequest={control.declineRequest}
            onAcceptOffer={control.acceptOffer}
            onDeclineOffer={control.declineOffer}
            onCancelRequest={control.cancelRequest}
            onDismissOutcome={control.dismissOutcome}
          />
        </div>
      </ErrorBoundary>
      <ErrorBoundary label="Agent launch" fallback={null}>
        <AgentLaunchDialog code={launchCode} onCancel={() => setLaunchCode(null)} />
      </ErrorBoundary>
      <CallTimer />
      <ConnectionStatus />
      {overlay}
      {/* The single feed handed to native Picture-in-Picture. Kept in the DOM
          and playing (PiP requires that) but visually out of the way — the grid
          renders the real tiles. */}
      <video ref={pipVideoRef} autoPlay playsInline muted className="pointer-events-none fixed bottom-0 right-0 -z-10 h-px w-px opacity-0" />
    </>
  );
}

export { Centered };
