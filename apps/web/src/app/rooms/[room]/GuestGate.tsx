"use client";

import { PreJoin, type LocalUserChoices } from "@livekit/components-react";
import "@livekit/components-styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import CallStage from "./CallStage";
import { Centered } from "./ui";

type Connection = { token: string; livekitUrl: string };

// Guest join flow:
//   1. precheck  — confirm the room exists before prompting for camera/mic.
//   2. check     — the Device Check (PreJoin): name + camera/mic self-preview.
//                  Completing it and pressing the join button IS the agreement,
//                  and only then is the knock sent. The guest may proceed with
//                  camera/mic off or denied; the check is shown, not enforced.
//   3. waiting   — knock sent; poll for the host's decision. PreJoin unmounted,
//                  so its camera/mic stream is released while idle.
//   4. admitted  — re-acquire the chosen devices and hand off to <CallStage>,
//                  which skips its own PreJoin because we pass the choices in.
export default function GuestGate({
  room,
  onLeave,
  onError,
}: {
  room: string;
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<
    "precheck" | "check" | "knocking" | "waiting" | "denied"
  >("precheck");
  const [title, setTitle] = useState<string | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [knockId, setKnockId] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);

  // Precheck: the room must exist before we ever ask for camera/mic, so a guest
  // never grants permission for a dead room. 404 ends the flow immediately.
  useEffect(() => {
    let active = true;
    api
      .getPublicRoom(room)
      .then((r) => {
        if (!active) return;
        setTitle(r.title);
        setPhase("check");
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      });
    return () => {
      active = false;
    };
  }, [room, onError]);

  // Device Check complete → send the knock, carrying the entered name. This runs
  // from a button click (not an effect), so it can't double-fire under
  // StrictMode; the ref guards against a stray second submit.
  const knockedRef = useRef(false);
  const submitCheck = useCallback(
    async (userChoices: LocalUserChoices) => {
      if (knockedRef.current) return;
      knockedRef.current = true;
      setChoices(userChoices);
      setPhase("knocking");
      try {
        const res = await api.knock(room, userChoices.username);
        setKnockId(res.knockId);
        setPhase("waiting");
      } catch (e) {
        knockedRef.current = false;
        if (e instanceof ApiError && e.status === 404) {
          onError("That room doesn't exist yet. Ask the host to create it.");
        } else {
          onError("Couldn't reach the server. Is the API running?");
        }
      }
    },
    [room, onError]
  );

  // Poll the host's decision once we have a knock.
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
          setPhase("denied");
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

  // Admitted: re-acquire the chosen devices and enter the call. CallStage skips
  // its own PreJoin because we hand it the choices made before the knock.
  if (connection && choices) {
    return (
      <CallStage
        connection={connection}
        displayName={choices.username}
        initialChoices={choices}
        onLeave={onLeave}
        onError={onError}
      />
    );
  }

  if (phase === "denied") {
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

  // Device Check: name + camera/mic preview. The join button sends the knock.
  if (phase === "check") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-6 p-4"
        data-lk-theme="default"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{title ?? "Join meeting"}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Check your camera and microphone, then ask the host to let you in.
          </p>
        </div>
        <PreJoin
          defaults={{ username: "", videoEnabled: true, audioEnabled: true }}
          onSubmit={submitCheck}
          // The Device Check is informational: a denied or missing camera/mic
          // must not block the knock, so device errors are logged, not surfaced.
          onError={(e) =>
            console.warn("Device Check error (continuing):", e.message)
          }
          joinLabel="Ask to join"
          persistUserChoices={false}
        />
      </main>
    );
  }

  // precheck / knocking / waiting
  return (
    <Centered>
      <p className="text-black/60 dark:text-white/60">
        {phase === "precheck"
          ? "Loading…"
          : phase === "knocking"
            ? "Requesting to join…"
            : `Waiting for the host to let you in to “${room}”…`}
      </p>
      {phase === "waiting" && (
        <button
          onClick={cancel}
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Cancel
        </button>
      )}
    </Centered>
  );
}
