"use client";

import { useRemoteParticipants, useRoomInfo } from "@livekit/components-react";
import {
  Check,
  Copy,
  Settings2,
  UserCheck,
  UserMinus,
  UserX,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type PendingKnock } from "@/lib/api";
import IconButton from "@/components/IconButton";
import RecordingControls from "./RecordingControls";

export default function HostPanel({
  room,
  hostKey,
}: {
  room: string;
  hostKey: string;
}) {
  const participants = useRemoteParticipants();
  const { metadata } = useRoomInfo();
  const muteOnEntry = useMemo(() => {
    if (!metadata) return false;
    try {
      return (
        (JSON.parse(metadata) as { muteOnEntry?: unknown }).muteOnEntry === true
      );
    } catch {
      return false;
    }
  }, [metadata]);
  const [knocks, setKnocks] = useState<PendingKnock[]>([]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      // clipboard may be blocked
    }
  }, [inviteLink]);

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

  const toggleMuteOnEntry = () =>
    withBusy("mute-on-entry", () =>
      api.setMuteOnEntry(room, !muteOnEntry, hostKey)
    );

  if (!open) {
    return (
      <div className="absolute right-3 top-3 z-20">
        <IconButton
          icon={Settings2}
          label={`Host controls${knocks.length ? ` (${knocks.length} waiting)` : ""}`}
          variant="subtle"
          size="lg"
          className="bg-black/70 backdrop-blur"
          onClick={() => setOpen(true)}
        />
      </div>
    );
  }

  return (
    <aside className="absolute right-3 top-3 z-20 flex max-h-[80dvh] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl bg-black/75 text-white shadow-lg backdrop-blur transition-all">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Host controls</span>
        <IconButton
          icon={X}
          label="Collapse host controls"
          size="sm"
          className="text-white/60 hover:text-white hover:bg-white/15"
          onClick={() => setOpen(false)}
        />
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
            <IconButton
              icon={copied ? Check : Copy}
              label={copied ? "Copied!" : "Copy invite link"}
              variant="subtle"
              size="sm"
              onClick={copyInvite}
            />
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
                    <IconButton
                      icon={UserCheck}
                      label={`Admit ${k.name}`}
                      size="sm"
                      className="bg-emerald-500 text-black hover:bg-emerald-400"
                      disabled={busy === `admit-${k.knockId}`}
                      onClick={() => admit(k)}
                    />
                    <IconButton
                      icon={UserX}
                      label={`Deny ${k.name}`}
                      variant="subtle"
                      size="sm"
                      disabled={busy === `deny-${k.knockId}`}
                      onClick={() => deny(k)}
                    />
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
          <button
            onClick={toggleMuteOnEntry}
            disabled={busy === "mute-on-entry"}
            aria-pressed={muteOnEntry}
            className={`mb-3 w-full rounded-md px-2 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/30 disabled:opacity-50 ${
              muteOnEntry
                ? "bg-amber-400 text-black hover:bg-amber-300"
                : "bg-white/15 hover:bg-white/25"
            }`}
          >
            {muteOnEntry ? "Muted on entry — allow unmuting" : "Mute all"}
          </button>
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
                    <IconButton
                      icon={VolumeX}
                      label={`Mute ${p.name || p.identity}`}
                      variant="subtle"
                      size="sm"
                      disabled={busy === `mute-${p.identity}`}
                      onClick={() => mute(p.identity)}
                    />
                    <IconButton
                      icon={UserMinus}
                      label={`Remove ${p.name || p.identity}`}
                      variant="danger"
                      size="sm"
                      disabled={busy === `remove-${p.identity}`}
                      onClick={() => remove(p.identity)}
                    />
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
