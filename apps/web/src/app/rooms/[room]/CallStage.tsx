"use client";

import { LiveKitRoom, RoomAudioRenderer, useChat, type LocalUserChoices } from "@livekit/components-react";
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import AgentLaunchDialog from "@/components/call/AgentLaunchDialog";
import ChatPanel from "@/components/call/ChatPanel";
import ConnectionStatus from "@/components/call/ConnectionStatus";
import ControlBar from "@/components/call/ControlBar";
import PresentationToast from "@/components/call/PresentationToast";
import PreJoinScreen from "@/components/call/PreJoinScreen";
import RemoteControlBanner from "@/components/call/RemoteControlBanner";
import RemoteControlSurface from "@/components/call/RemoteControlSurface";
import RemoteControlToast from "@/components/call/RemoteControlToast";
import VideoGrid from "@/components/call/VideoGrid";
import { usePresentation } from "@/components/call/usePresentation";
import { useRemoteControl } from "@/components/call/useRemoteControl";
import { api, API_URL } from "@/lib/api";
import LeaveConfirmDialog from "./LeaveConfirmDialog";
import { Centered } from "./ui";

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
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(initialChoices ?? null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
    onLeave();
  }, [onLeave]);

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
        style={{ height: "100dvh" }}
        className="bg-dotgrid"
      >
        <CallView room={room} token={connection.token} onLeaveClick={() => setShowLeaveDialog(true)} overlay={overlay} isHost={isHost} />
        <RoomAudioRenderer />
      </LiveKitRoom>
      <LeaveConfirmDialog open={showLeaveDialog} onConfirm={confirmLeave} onCancel={() => setShowLeaveDialog(false)} />
    </main>
  );
}

function CallView({
  room,
  token,
  onLeaveClick,
  overlay,
  isHost,
}: {
  room: string;
  token: string;
  onLeaveClick: () => void;
  overlay?: ReactNode;
  isHost: boolean;
}) {
  const { chatMessages, send, isSending } = useChat();
  const [chatOpen, setChatOpen] = useState(false);

  const presentation = usePresentation(isHost);
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
    () => false
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
      const frame = document.createElement("iframe");
      frame.style.display = "none";
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
      />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} messages={chatMessages} onSend={send} isSending={isSending} />
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
      />
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
      <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex flex-col items-center gap-2">
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
      <AgentLaunchDialog code={launchCode} onCancel={() => setLaunchCode(null)} />
      <ConnectionStatus />
      {overlay}
    </>
  );
}

export { Centered };
