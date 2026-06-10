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
import HuddleIcon from "@/components/HuddleIcon";

export default function Lobby() {
  const { data: session, isPending } = useSession();

  return (
    <Shell>
      {isPending ? (
        <p className="text-white/60">Loading…</p>
      ) : session ? (
        <HostDashboard userName={session.user.name} onSignOut={() => signOut()} />
      ) : (
        <SignIn />
      )}
    </Shell>
  );
}

// Split hero: a dramatic brand panel on the left, the live auth/dashboard card
// on the right. Drifting neon blobs sit behind the dot-grid body backdrop.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Ambient neon blobs. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-drift absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-magenta/20 blur-[120px]" />
        <div className="animate-drift absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan/15 blur-[120px] [animation-delay:5s]" />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <HeroCopy />
        <div className="glass-strong w-full max-w-md justify-self-center rounded-2xl p-8 shadow-[0_8px_60px_oklch(0_0_0/0.5)] lg:justify-self-end">
          {children}
        </div>
      </div>
    </main>
  );
}

function HeroCopy() {
  return (
    <div className="space-y-7 text-center lg:text-left">
      <div className="flex items-center justify-center gap-3 lg:justify-start">
        <HuddleIcon className="size-10 drop-shadow-[0_0_12px_rgba(217,70,168,0.5)]" />
        <span className="font-display text-2xl font-bold tracking-[0.3em] text-white">
          HUD<span className="text-magenta text-glow-magenta">DLE</span>
        </span>
      </div>
      <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
        Meetings,
        <br />
        <span className="text-magenta text-glow-magenta">reimagined.</span>
      </h1>
      <p className="mx-auto max-w-md text-lg text-white/65 lg:mx-0">
        Self-hosted, real-time video for teams who want control. Guests join with just a link — no account, no installs.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
        {["Self-hosted", "Knock-to-join", "Record & download"].map((t) => (
          <span key={t} className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-sm text-white/75 backdrop-blur">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shared input styling for the auth form.
const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none transition-colors placeholder:text-white/40 focus:border-cyan/60 focus:ring-2 focus:ring-cyan/30";

function SignIn() {
  const callbackURL = typeof window !== "undefined" ? window.location.origin : undefined;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() && password.length >= 8 && (mode === "signin" || name.trim()) && !busy;

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
      setError(result.error.message ?? (mode === "signup" ? "Couldn't create that account." : "Wrong email or password."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold text-white">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <p className="text-sm text-white/55">
          {mode === "signup" ? "Create an account to host or schedule a meeting." : "Sign in to host or schedule a meeting."}
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" autoComplete="name" className={inputClass} />
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={inputClass} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />

        {error && <p className="text-sm text-magenta">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="neon-magenta w-full rounded-lg bg-magenta px-4 py-2.5 font-display font-semibold tracking-wide text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
        className="text-sm text-white/55 underline-offset-2 transition-colors hover:text-cyan hover:underline"
      >
        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>

      <div className="border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => signIn.social({ provider: "google", callbackURL })}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
        >
          Continue with Google
        </button>
      </div>

      <p className="text-xs text-white/45">Have a meeting link? Just open it — you don&apos;t need an account to join.</p>
    </div>
  );
}

function HostDashboard({ userName, onSignOut }: { userName: string; onSignOut: () => void }) {
  const router = useRouter();
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
      setError(e instanceof ApiError && e.status === 401 ? "Your session expired — sign in again." : "Couldn't create the meeting. Is the API running?");
    }
  }

  async function handleSchedule(iso: string) {
    if (!iso || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRoom({ scheduledStart: iso });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Your session expired — sign in again." : "Couldn't create the meeting. Is the API running?");
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
          <h2 className="font-display text-2xl font-semibold text-white">Dashboard</h2>
          <p className="text-sm text-white/55">Signed in as {userName}</p>
        </div>
        <IconButton icon={LogOut} label="Sign out" className="text-white/70 hover:bg-white/15 hover:text-white" onClick={onSignOut} />
      </header>

      {error && <p className="text-sm text-magenta">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleInstant}
          disabled={busy}
          className="neon-magenta flex flex-1 items-center justify-center gap-2 rounded-lg bg-magenta px-4 py-2.5 font-display font-semibold tracking-wide text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Play className="h-4 w-4" />
          Instant
        </button>

        <DateTimePicker
          onSchedule={handleSchedule}
          disabled={busy}
          triggerClassName="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 disabled:opacity-40"
        >
          <span>Schedule</span>
          <Calendar size={16} />
        </DateTimePicker>
      </div>

      <MeetingList rooms={rooms} onStart={startRoom} />

      <Link href="/recordings" className="block text-sm text-white/55 underline-offset-2 transition-colors hover:text-cyan hover:underline">
        View past recordings →
      </Link>
    </div>
  );
}

function MeetingList({ rooms, onStart }: { rooms: RoomSummary[] | null; onStart: (slug: string) => void }) {
  if (rooms === null) return null;
  if (rooms.length === 0) {
    return <p className="text-sm text-white/45">No upcoming scheduled meetings.</p>;
  }
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        <span className="h-3 w-0.5 rounded-full bg-gradient-to-b from-magenta to-cyan" />
        Upcoming meetings
      </h3>
      <ul className="divide-y divide-white/10">
        {rooms.map((r) => (
          <MeetingRow key={r.room} room={r} onStart={() => onStart(r.room)} />
        ))}
      </ul>
    </div>
  );
}

function MeetingRow({ room, onStart }: { room: RoomSummary; onStart: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/rooms/${encodeURIComponent(room.room)}` : "";

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
          <p className="truncate font-medium text-white/90">{room.scheduledStart ? new Date(room.scheduledStart).toLocaleString() : "Anytime"}</p>
          <p className="font-mono text-xs text-cyan/80">{room.room}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            icon={copied ? Check : Copy}
            label={copied ? "Copied!" : "Copy meeting link"}
            className="text-white/70 hover:bg-white/15 hover:text-white"
            onClick={copy}
          />
          <IconButton icon={Play} label="Start meeting" className="bg-cyan text-black hover:brightness-110" onClick={onStart} />
        </div>
      </div>
    </li>
  );
}
