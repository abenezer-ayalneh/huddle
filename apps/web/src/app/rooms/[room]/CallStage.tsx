"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  PreJoin,
  VideoConference,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useState, type ReactNode } from "react";
import { Centered } from "./ui";

type Connection = { token: string; livekitUrl: string };

// Device pre-join → connect → call. Given a ready connection (token already
// minted, whether host or admitted guest), it owns only the local-device step
// and the LiveKit connection. `overlay` renders inside the room (host panel).
export default function CallStage({
  connection,
  displayName,
  onLeave,
  onError,
  overlay,
}: {
  connection: Connection;
  displayName: string;
  onLeave: () => void;
  onError: (message: string) => void;
  overlay?: ReactNode;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);

  // Step 1 — pre-join: self-preview + camera/mic pickers (F7).
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
    <main className="relative flex-1" data-lk-theme="default">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.livekitUrl}
        connect
        video={
          choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false
        }
        audio={
          choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false
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
    </main>
  );
}

export { Centered };
