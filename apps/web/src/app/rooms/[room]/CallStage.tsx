"use client";

import { LiveKitRoom, RoomAudioRenderer, useChat, type LocalUserChoices } from "@livekit/components-react";
import { useCallback, useState, type ReactNode } from "react";
import ChatPanel from "@/components/call/ChatPanel";
import ConnectionStatus from "@/components/call/ConnectionStatus";
import ControlBar from "@/components/call/ControlBar";
import PresentationToast from "@/components/call/PresentationToast";
import PreJoinScreen from "@/components/call/PreJoinScreen";
import VideoGrid from "@/components/call/VideoGrid";
import { usePresentation } from "@/components/call/usePresentation";
import LeaveConfirmDialog from "./LeaveConfirmDialog";
import { Centered } from "./ui";

type Connection = { token: string; livekitUrl: string };

export default function CallStage({
  connection,
  displayName,
  onLeave,
  onError,
  overlay,
  initialChoices,
  startMuted = false,
  isHost = false,
}: {
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
        <CallView onLeaveClick={() => setShowLeaveDialog(true)} overlay={overlay} isHost={isHost} />
        <RoomAudioRenderer />
      </LiveKitRoom>
      <LeaveConfirmDialog open={showLeaveDialog} onConfirm={confirmLeave} onCancel={() => setShowLeaveDialog(false)} />
    </main>
  );
}

function CallView({ onLeaveClick, overlay, isHost }: { onLeaveClick: () => void; overlay?: ReactNode; isHost: boolean }) {
  const { chatMessages, send, isSending } = useChat();
  const [chatOpen, setChatOpen] = useState(false);

  const presentation = usePresentation(isHost);

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
      <VideoGrid />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} messages={chatMessages} onSend={send} isSending={isSending} />
      <ControlBar
        onLeave={onLeaveClick}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        unreadChat={unread}
        iAmPresenting={presentation.iAmPresenting}
        someoneElsePresenting={presentation.someoneElsePresenting}
        onShareClick={presentation.handleShareClick}
        hasOutgoingRequest={!!presentation.outgoing}
      />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center">
        <PresentationToast
          outgoing={presentation.outgoing}
          incoming={presentation.incoming}
          outcome={presentation.outcome}
          onCancel={presentation.cancelRequest}
          onYield={presentation.yieldPresentation}
          onDecline={presentation.declinePresentation}
          onDismissOutcome={presentation.dismissOutcome}
        />
      </div>
      <ConnectionStatus />
      {overlay}
    </>
  );
}

export { Centered };
