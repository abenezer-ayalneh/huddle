"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Check, Copy, LogOut, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api, type RoomSummary } from "@/lib/api";
import { signIn, signUp, signOut, useSession } from "@/lib/auth-client";
import { saveHostSession } from "@/lib/hostSession";
import DateTimePicker from "@/components/DateTimePicker";
import IconButton from "@/components/IconButton";

export default function Lobby() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <Shell>
        <p className="text-black/60 dark:text-white/60">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      {session ? (
        <HostDashboard
          userName={session.user.name}
          onSignOut={() => signOut()}
        />
      ) : (
        <SignIn />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-black/10 p-8 shadow-sm dark:border-white/15">
        {children}
      </div>
    </main>
  );
}

function SignIn() {
  const callbackURL =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    email.trim() &&
    password.length >= 8 &&
    (mode === "signin" || name.trim()) &&
    !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result =
      mode === "signup"
        ? await signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      setError(
        result.error.message ??
          (mode === "signup"
            ? "Couldn't create that account."
            : "Wrong email or password.")
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Huddle</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {mode === "signup"
            ? "Create an account to host or schedule a meeting."
            : "Sign in to host or schedule a meeting."}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            autoComplete="name"
            className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="w-full rounded-md border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white transition-all hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80 dark:focus-visible:ring-white/30"
        >
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="text-sm text-black/60 underline-offset-2 hover:underline dark:text-white/60"
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>

      <div className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={() => signIn.social({ provider: "google", callbackURL })}
          className="w-full rounded-md border border-black/15 px-4 py-2 font-medium transition-all hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/20 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
        >
          Continue with Google
        </button>
      </div>

      <p className="text-xs text-black/50 dark:text-white/50">
        Have a meeting link? Just open it — you don't need an account to join.
      </p>
    </div>
  );
}

function HostDashboard({
  userName,
  onSignOut,
}: {
  userName: string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [scheduledStart, setScheduledStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const refresh = useCallback(() => {
    api
      .listMine()
      .then((r) => setRooms(r.rooms))
      .catch(() => setRooms([]));
  }, []);
  useEffect(refresh, [refresh]);

  const enterAsHost = useCallback(
    (result: Awaited<ReturnType<typeof api.createRoom>>) => {
      saveHostSession(result.room, {
        token: result.token,
        hostKey: result.hostKey,
        identity: result.identity,
        livekitUrl: result.livekitUrl,
        name: userName,
      });
      router.push(`/rooms/${encodeURIComponent(result.room)}`);
    },
    [router, userName]
  );

  // "Instant" button — create a room and jump straight into the call.
  async function handleInstant() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      enterAsHost(await api.createRoom());
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof ApiError && e.status === 401
          ? "Your session expired — sign in again."
          : "Couldn't create the meeting. Is the API running?"
      );
    }
  }

  // Called when the user picks a date+time in the calendar popover. Creates a
  // scheduled meeting immediately and refreshes the upcoming list. Clearing the
  // picker (empty string) is a no-op.
  async function handleSchedule(iso: string) {
    setScheduledStart(iso);
    if (!iso || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRoom({ scheduledStart: iso });
      setScheduledStart("");
      refresh();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Your session expired — sign in again."
          : "Couldn't create the meeting. Is the API running?"
      );
    } finally {
      setBusy(false);
    }
  }

  async function startRoom(slug: string) {
    try {
      enterAsHost(await api.hostJoin(slug));
    } catch {
      setError("Couldn't start that meeting.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Huddle</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Signed in as {userName}
          </p>
        </div>
        <IconButton icon={LogOut} label="Sign out" onClick={onSignOut} />
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleInstant}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-black px-4 py-2.5 font-medium text-white transition-all hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80 dark:focus-visible:ring-white/30"
        >
          Instant
        </button>

        <DateTimePicker
          value={scheduledStart}
          onChange={handleSchedule}
          disabled={busy}
          triggerClassName="flex flex-1 items-center justify-center gap-2 rounded-md border border-black/15 px-4 py-2.5 font-medium transition-all hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
        >
          <span>Schedule</span>
          <Calendar size={16} />
        </DateTimePicker>
      </div>

      <MeetingList rooms={rooms} onStart={startRoom} />

      <Link
        href="/recordings"
        className="block text-sm text-black/60 underline-offset-2 hover:underline dark:text-white/60"
      >
        View past recordings →
      </Link>
    </div>
  );
}

function MeetingList({
  rooms,
  onStart,
}: {
  rooms: RoomSummary[] | null;
  onStart: (slug: string) => void;
}) {
  if (rooms === null) return null;
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        No upcoming scheduled meetings.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Upcoming meetings</h2>
      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {rooms.map((r) => (
          <MeetingRow key={r.room} room={r} onStart={() => onStart(r.room)} />
        ))}
      </ul>
    </div>
  );
}

function MeetingRow({
  room,
  onStart,
}: {
  room: RoomSummary;
  onStart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/rooms/${encodeURIComponent(room.room)}`
      : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {room.scheduledStart
              ? new Date(room.scheduledStart).toLocaleString()
              : "Anytime"}
          </p>
          <p className="font-mono text-xs text-black/50 dark:text-white/50">
            {room.room}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            icon={copied ? Check : Copy}
            label={copied ? "Copied!" : "Copy meeting link"}
            onClick={copy}
          />
          <IconButton
            icon={Play}
            label="Start meeting"
            variant="solid"
            onClick={onStart}
          />
        </div>
      </div>
    </li>
  );
}
