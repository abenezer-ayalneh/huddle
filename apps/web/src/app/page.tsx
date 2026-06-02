"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Lobby: collect a display name + room name, then navigate to the room.
// (Device pre-join / self-preview is Phase 3 — F7.)
export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  const canJoin = name.trim().length > 0 && room.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canJoin) return;
    const params = new URLSearchParams({ name: name.trim() });
    router.push(`/rooms/${encodeURIComponent(room.trim())}?${params}`);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-black/10 p-8 shadow-sm dark:border-white/15"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Huddle</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter a name and a room to join the call.
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

        <button
          type="submit"
          disabled={!canJoin}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Join
        </button>
      </form>
    </main>
  );
}
