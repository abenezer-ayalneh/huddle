"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  PreJoin,
  VideoConference,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { makeIdentity } from "@/lib/identity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Connection = { token: string; livekitUrl: string };

export default function RoomClient({
  room,
  displayName,
}: {
  room: string;
  displayName: string;
}) {
  const router = useRouter();

  // The pre-join screen (F7) collects device + enabled choices before we
  // request a token or touch the network. Null until the user clicks "Join".
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => router.push("/"), [router]);

  // Fetch a token only after the user confirms their devices in pre-join.
  useEffect(() => {
    if (!choices) return;
    let cancelled = false;

    // Honor the name the user confirmed in pre-join; fall back to the lobby value.
    const name = choices.username.trim() || displayName;
    const identity = makeIdentity(name);

    async function fetchToken() {
      try {
        const res = await fetch(`${API_URL}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, identity, name }),
        });
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = (await res.json()) as Connection;
        if (!cancelled) setConnection(data);
      } catch {
        // Network failure (API down) or non-OK response — both land here.
        if (!cancelled) {
          setError("Couldn't reach the server. Is the API running?");
        }
      }
    }

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [choices, room, displayName]);

  if (error) {
    return (
      <Centered>
        <p className="text-red-500">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setError(null);
              setConnection(null);
              setChoices(null);
            }}
            className="rounded-md bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
          >
            Try again
          </button>
          <button
            onClick={leave}
            className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20"
          >
            Back to lobby
          </button>
        </div>
      </Centered>
    );
  }

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
            setError(
              `Couldn't access your camera or microphone: ${e.message}. Check browser permissions and try again.`
            )
          }
          joinLabel={`Join ${room}`}
          persistUserChoices={false}
        />
      </main>
    );
  }

  // Step 2 — waiting on the token.
  if (!connection) {
    return (
      <Centered>
        <p className="text-black/60 dark:text-white/60">Connecting…</p>
      </Centered>
    );
  }

  // Step 3 — connected: publish the chosen devices and render the call.
  return (
    <main className="flex-1" data-lk-theme="default">
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
        onDisconnected={leave}
        onError={(e) => setError(`Lost connection to the call: ${e.message}`)}
        style={{ height: "100dvh" }}
      >
        <VideoConference />
        {/* F9 — surfaces connecting / reconnecting / disconnected states. */}
        <ConnectionStateToast />
      </LiveKitRoom>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}
