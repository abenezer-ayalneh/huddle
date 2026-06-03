"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import CallStage from "./CallStage";
import { Centered } from "./ui";

type Connection = { token: string; livekitUrl: string };

// Guest waiting-room flow: knock → poll for the host's decision → once admitted,
// hand the minted token to <CallStage>.
export default function GuestGate({
  room,
  displayName,
  onLeave,
  onError,
}: {
  room: string;
  displayName: string;
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<"knocking" | "waiting" | "denied">(
    "knocking"
  );
  const [connection, setConnection] = useState<Connection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function start() {
      let knockId: string;
      try {
        ({ knockId } = await api.knock(room, displayName));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
        return;
      }
      if (cancelled) return;
      setStatus("waiting");

      // Poll the host's decision until admitted or denied.
      async function poll() {
        try {
          const res = await api.knockStatus(room, knockId);
          if (cancelled) return;
          if (res.status === "admitted" && res.token && res.livekitUrl) {
            setConnection({ token: res.token, livekitUrl: res.livekitUrl });
            return;
          }
          if (res.status === "denied") {
            setStatus("denied");
            return;
          }
        } catch {
          // Transient — keep waiting and retry.
        }
        timer = setTimeout(poll, 2000);
      }
      poll();
    }

    start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room, displayName, onError]);

  if (connection) {
    return (
      <CallStage
        connection={connection}
        displayName={displayName}
        onLeave={onLeave}
        onError={onError}
      />
    );
  }

  if (status === "denied") {
    return (
      <Centered>
        <p className="text-red-500">The host declined your request to join.</p>
        <button
          onClick={onLeave}
          className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20"
        >
          Back to lobby
        </button>
      </Centered>
    );
  }

  return (
    <Centered>
      <p className="text-black/60 dark:text-white/60">
        {status === "knocking"
          ? "Requesting to join…"
          : `Waiting for the host to let you in to “${room}”…`}
      </p>
      <button
        onClick={onLeave}
        className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
      >
        Cancel
      </button>
    </Centered>
  );
}
