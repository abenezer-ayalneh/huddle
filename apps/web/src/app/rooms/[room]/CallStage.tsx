"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useChat,
  type LocalUserChoices,
} from "@livekit/components-react";
import { useCallback, useState, type ReactNode } from "react";
import ChatPanel from "@/components/call/ChatPanel";
import ConnectionStatus from "@/components/call/ConnectionStatus";
import ControlBar from "@/components/call/ControlBar";
import PreJoinScreen from "@/components/call/PreJoinScreen";
import VideoGrid from "@/components/call/VideoGrid";
import LeaveConfirmDialog from "./LeaveConfirmDialog";
import { Centered } from "./ui";

type Connection = { token: string; livekitUrl: string };

// Device pre-join → connect → call. Given a ready connection (token already
// minted, whether host or admitted guest), it owns only the local-device step
// and the LiveKit connection. `overlay` renders inside the room (host panel).
//
// A guest has already completed the Device Check before knocking, so they pass
// their `initialChoices` in and this skips PreJoin entirely — the guest does the
// camera/mic step exactly once. A host arrives with no choices and PreJoins here.
//
// The call view is built from our own components (VideoGrid + ControlBar + chat)
// on top of LiveKit's headless hooks — see ADR 0008. RoomAudioRenderer is
// included explicitly because we no longer use <VideoConference>, which bundled
// it (and the screen-share + chat controls we now provide ourselves).
export default function CallStage({
  connection,
  displayName,
  onLeave,
  onError,
  overlay,
  initialChoices,
  startMuted = false,
}: {
  connection: Connection;
  displayName: string;
  onLeave: () => void;
  onError: (message: string) => void;
  overlay?: ReactNode;
  initialChoices?: LocalUserChoices;
  // Honors the room's Mute-on-Entry flag: connect with the mic off regardless of
  // the device choice, so there's no window of live audio on entry. The
  // participant can still unmute themselves once in the call (soft mute).
  startMuted?: boolean;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(
    initialChoices ?? null
  );
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
    onLeave();
  }, [onLeave]);

  // Step 1 — pre-join: self-preview + camera/mic pickers (F7). Skipped when the
  // caller supplied choices (an admitted guest who already did the Device Check).
  if (!choices) {
    return (
      <PreJoinScreen
        defaults={{
          username: displayName,
          videoEnabled: true,
          audioEnabled: true,
        }}
        onSubmit={setChoices}
        onError={(e) =>
          onError(
            `Couldn't access your camera or microphone: ${e.message}. Check browser permissions and try again.`
          )
        }
        heading="Ready to join?"
        subheading="Check your camera and mic before you go live."
        submitLabel="Join call"
      />
    );
  }

  // Step 2 — connected: publish the chosen devices and render the call.
  return (
    <main className="relative flex-1">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.livekitUrl}
        connect
        video={
          choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false
        }
        audio={
          startMuted || !choices.audioEnabled
            ? false
            : { deviceId: choices.audioDeviceId }
        }
        onDisconnected={onLeave}
        onError={(e) => onError(`Lost connection to the call: ${e.message}`)}
        style={{ height: "100dvh" }}
        className="bg-dotgrid"
      >
        <CallView
          onLeaveClick={() => setShowLeaveDialog(true)}
          overlay={overlay}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      <LeaveConfirmDialog
        open={showLeaveDialog}
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveDialog(false)}
      />
    </main>
  );
}

// Lives inside the LiveKitRoom context so it can use room hooks. Owns the single
// chat subscription (shared by the panel and the control-bar unread badge) and
// the chat open/close state.
function CallView({
  onLeaveClick,
  overlay,
}: {
  onLeaveClick: () => void;
  overlay?: ReactNode;
}) {
  const { chatMessages, send, isSending } = useChat();
  const [chatOpen, setChatOpen] = useState(false);

  // Unread badge, reconciled by adjusting state during render (the pattern React
  // recommends over an effect): whenever the message count or panel visibility
  // changes, clear the badge if the panel is open, otherwise add the new
  // messages to it.
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
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSend={send}
        isSending={isSending}
      />
      <ControlBar
        onLeave={onLeaveClick}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        unreadChat={unread}
      />
      <ConnectionStatus />
      {overlay}
    </>
  );
}

export { Centered };
