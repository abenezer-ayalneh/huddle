"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { saveHostSession } from "@/lib/hostSession";

// Lobby: enter a name + room, then either CREATE the room (become host) or
// JOIN it (knock as a guest and wait to be admitted). Managed rooms (Phase 6):
// a guest can only join a room a host has created.
export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState<null | "create" | "join">(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && room.trim().length > 0 && busy === null;

  function goToRoom(role: "host" | "guest") {
    const params = new URLSearchParams({ name: name.trim(), role });
    router.push(`/rooms/${encodeURIComponent(room.trim())}?${params}`);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy("create");
    setError(null);
    try {
      const result = await api.createRoom(room.trim(), name.trim());
      saveHostSession(result.room, {
        token: result.token,
        hostKey: result.hostKey,
        identity: result.identity,
        livekitUrl: result.livekitUrl,
      });
      goToRoom("host");
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiError && e.status === 409) {
        setError("That room name is taken. Pick another, or join it instead.");
      } else {
        setError("Couldn't create the room. Is the API running?");
      }
    }
  }

  function handleJoin() {
    if (!canSubmit) return;
    // The knock happens on the room page (GuestGate); just navigate.
    goToRoom("guest");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="w-full max-w-sm space-y-5 rounded-xl border border-black/10 p-8 shadow-sm dark:border-white/15"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Huddle</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Create a room to host, or join one you’ve been invited to.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Abenezer"
            autoComplete="off"
            className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Room</span>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="team-standup"
            autoComplete="off"
            className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-black px-4 py-2 font-medium text-white transition disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy === "create" ? "Creating…" : "Create room"}
          </button>
          <button
            type="button"
            onClick={handleJoin}
            disabled={!canSubmit}
            className="flex-1 rounded-md border border-black/15 px-4 py-2 font-medium transition disabled:opacity-40 dark:border-white/20"
          >
            Join room
          </button>
        </div>
      </form>
    </main>
  );
}
