"use client";

import { useRemoteParticipants } from "@livekit/components-react";
import { useCallback, useEffect, useState } from "react";
import { api, type PendingKnock } from "@/lib/api";
import RecordingControls from "./RecordingControls";

// Host-only overlay: admit/deny waiting guests and mute/remove participants.
// Rendered inside <LiveKitRoom>, so it can read the live participant list.
export default function HostPanel({
  room,
  hostKey,
}: {
  room: string;
  hostKey: string;
}) {
  const participants = useRemoteParticipants();
  const [knocks, setKnocks] = useState<PendingKnock[]>([]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The guest share-link. This is the only place a host of an INSTANT meeting can
  // get it (instant meetings aren't in the lobby's upcoming list).
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/rooms/${encodeURIComponent(room)}`
      : "";

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; ignore
    }
  }, [inviteLink]);

  // Poll the waiting room for pending guests.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { knocks } = await api.listKnocks(room, hostKey);
        if (!cancelled) setKnocks(knocks);
      } catch {
        // Transient — keep the last known list and try again next tick.
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room, hostKey]);

  const withBusy = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      setBusy(key);
      try {
        await fn();
      } catch {
        // Surface nothing intrusive; the periodic poll / participant list
        // will reconcile state on the next update.
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const admit = (k: PendingKnock) =>
    withBusy(`admit-${k.knockId}`, async () => {
      await api.admit(room, k.knockId, hostKey);
      setKnocks((prev) => prev.filter((p) => p.knockId !== k.knockId));
    });

  const deny = (k: PendingKnock) =>
    withBusy(`deny-${k.knockId}`, async () => {
      await api.deny(room, k.knockId, hostKey);
      setKnocks((prev) => prev.filter((p) => p.knockId !== k.knockId));
    });

  const mute = (identity: string) =>
    withBusy(`mute-${identity}`, () => api.mute(room, identity, true, hostKey));

  const remove = (identity: string) =>
    withBusy(`remove-${identity}`, () =>
      api.removeParticipant(room, identity, hostKey)
    );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-20 rounded-md bg-black/70 px-3 py-1.5 text-sm text-white backdrop-blur"
      >
        Host{knocks.length ? ` (${knocks.length})` : ""}
      </button>
    );
  }

  return (
    <aside className="absolute right-3 top-3 z-20 flex max-h-[80dvh] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl bg-black/75 text-white shadow-lg backdrop-blur">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Host controls</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse host controls"
          className="text-white/60 hover:text-white"
        >
          ✕
        </button>
      </header>

      <div className="space-y-4 overflow-y-auto px-4 pb-4 text-sm">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
            Invite
          </h3>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white/10 px-2 py-1 text-xs text-white/80">
              {room}
            </code>
            <button
              onClick={copyInvite}
              className="shrink-0 rounded bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
            Recording
          </h3>
          <RecordingControls room={room} hostKey={hostKey} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
            Waiting room
          </h3>
          {knocks.length === 0 ? (
            <p className="text-white/50">No one waiting.</p>
          ) : (
            <ul className="space-y-2">
              {knocks.map((k) => (
                <li
                  key={k.knockId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{k.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => admit(k)}
                      disabled={busy === `admit-${k.knockId}`}
                      className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-black disabled:opacity-50"
                    >
                      Admit
                    </button>
                    <button
                      onClick={() => deny(k)}
                      disabled={busy === `deny-${k.knockId}`}
                      className="rounded bg-white/15 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
            Participants
          </h3>
          {participants.length === 0 ? (
            <p className="text-white/50">No other participants.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((p) => (
                <li
                  key={p.identity}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{p.name || p.identity}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => mute(p.identity)}
                      disabled={busy === `mute-${p.identity}`}
                      className="rounded bg-white/15 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Mute
                    </button>
                    <button
                      onClick={() => remove(p.identity)}
                      disabled={busy === `remove-${p.identity}`}
                      className="rounded bg-red-500/90 px-2 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
