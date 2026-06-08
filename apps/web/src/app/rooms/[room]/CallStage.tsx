"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  PreJoin,
  VideoConference,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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

  // Intercept LiveKit's built-in disconnect button: capture the click before it
  // reaches the button's own handler, show our confirmation modal instead.
  // Uses a callback ref so the listener attaches when the call view mounts
  // (after PreJoin completes), not on initial render when the ref would be null.
  const roomRefCb = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const intercept = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".lk-disconnect-button");
      if (btn) {
        e.stopPropagation();
        e.preventDefault();
        setShowLeaveDialog(true);
      }
    };
    node.addEventListener("click", intercept, true);
  }, []);

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
    onLeave();
  }, [onLeave]);

  // Step 1 — pre-join: self-preview + camera/mic pickers (F7). Skipped when the
  // caller supplied choices (an admitted guest who already did the Device Check).
  if (!choices) {
    return (
      <main
        className="flex flex-1 items-center justify-center p-4"
        data-lk-theme="default"
      >
        <PreJoin
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
          joinLabel="Join call"
          persistUserChoices={false}
        />
      </main>
    );
  }

  // Step 2 — connected: publish the chosen devices and render the call.
  return (
    <main className="relative flex-1" data-lk-theme="default" ref={roomRefCb}>
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
      >
        <VideoConference />
        {/* F9 — surfaces connecting / reconnecting / disconnected states. */}
        <ConnectionStateToast />
        {overlay}
      </LiveKitRoom>
      <LeaveConfirmDialog
        open={showLeaveDialog}
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveDialog(false)}
      />
    </main>
  );
}

export { Centered };
