"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [knockId, setKnockId] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);

  // Knock exactly once. A POST creates server-side state, so it must NOT fire
  // twice — and React StrictMode (dev) intentionally double-invokes mount
  // effects. A ref guard survives that double-invoke (same component instance).
  const knockedRef = useRef(false);
  useEffect(() => {
    if (knockedRef.current) return;
    knockedRef.current = true;

    (async () => {
      try {
        const res = await api.knock(room, displayName);
        setKnockId(res.knockId);
        setStatus("waiting");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      }
    })();
  }, [room, displayName, onError]);

  // Poll the host's decision once we have a knock. Separate effect so its
  // cleanup (clearing the timer) doesn't interfere with the one-shot knock.
  useEffect(() => {
    if (!knockId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.knockStatus(room, knockId!);
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
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [knockId, room]);

  // Withdraw the pending knock before leaving, so the host stops seeing it.
  // Best-effort: navigate home regardless of whether the request succeeds.
  const cancel = useCallback(async () => {
    if (knockId) {
      try {
        await api.cancelKnock(room, knockId);
      } catch {
        // ignore — the host can still deny a stale knock
      }
    }
    onLeave();
  }, [knockId, room, onLeave]);

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
        onClick={cancel}
        className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
      >
        Cancel
      </button>
    </Centered>
  );
}
