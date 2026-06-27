'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Check, Copy, LogOut, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, isFaultError, type RoomSummary } from '@/lib/api';
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';
import { emitFault } from '@/lib/faults';
import { saveHostSession } from '@/lib/hostSession';
import DateTimePicker from '@/components/DateTimePicker';
import IconButton from '@/components/IconButton';
import LoadingSpinner from '@/components/LoadingSpinner';

// Auth/dashboard card. Rendered inside the server-component lobby shell so the
// surrounding marketing copy (HeroCopy) and JSON-LD stay in static HTML for
// crawlers; only this interactive island ships as a client bundle.
export default function LobbyAuthCard() {
  const { data: session, isPending } = useSession();

  if (isPending) return <LoadingSpinner className="mx-auto size-12" />;
  if (session) return <HostDashboard userName={session.user.name} onSignOut={() => signOut()} />;
  return <SignIn />;
}

// Surface a genuine Fault on the global Fault toast (docs/adr/0019). All API
// calls reject with a FaultError; anything else gets a generic Fault so the user
// always sees feedback. Domain Outcomes that deserve inline UX are handled at
// their own call site, not here.
function surface(e: unknown): void {
  if (isFaultError(e)) emitFault(e.fault);
  else emitFault({ code: 'INTERNAL', message: 'Something went wrong. Please try again.', statusCode: 500 });
}

// Map a BetterAuth OAuth error code (delivered as ?error=…) to a friendly line.
function oauthErrorMessage(code: string): string {
  switch (code) {
    case 'account_not_linked':
      return 'This email already has an unverified account. Check your inbox for the verification link, confirm it, then continue with Google.';
    default:
      return "Couldn't sign in with Google. Please try again.";
  }
}

// Shared input styling for the auth form.
const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none transition-colors placeholder:text-white/40 focus:border-cyan/60 focus:ring-2 focus:ring-cyan/30';

function SignIn() {
  const callbackURL = typeof window !== 'undefined' ? window.location.origin : undefined;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface an OAuth failure bounced back via ?error=… (BetterAuth redirects
  // here when we pass errorCallbackURL). Strip the param afterwards so a refresh
  // doesn't keep re-showing it.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (!code) return;
    setError(oauthErrorMessage(code));
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const canSubmit = email.trim() && password.length >= 8 && (mode === 'signin' || name.trim()) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result =
      mode === 'signup'
        ? await signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      // A 4xx is a credential/validation Domain Outcome — keep it inline. A
      // connectivity failure (no/zero status) is a Fault already surfaced on the
      // toast by the auth wrapper (docs/adr/0019), so don't show a misleading
      // "wrong password" here.
      const status = result.error.status ?? 0;
      if (status >= 400) {
        setError(result.error.message ?? (mode === 'signup' ? "Couldn't create that account." : 'Wrong email or password.'));
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold text-white">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
        <p className="text-sm text-white/55">
          {mode === 'signup' ? 'Create an account to host or schedule a meeting.' : 'Sign in to host or schedule a meeting.'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {mode === 'signup' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" autoComplete="name" className={inputClass} />
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={inputClass} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className={inputClass}
        />

        {error && <p className="text-sm text-magenta">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="neon-magenta flex items-center justify-center gap-2 w-full rounded-lg bg-magenta px-4 py-2.5 font-display font-semibold tracking-wide text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy && <LoadingSpinner className="h-4 w-4" />}
          {!busy && (mode === 'signup' ? 'Create account' : 'Sign in')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
        className="text-sm text-white/55 underline-offset-2 transition-colors hover:text-cyan hover:underline"
      >
        {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>

      <div className="border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL });
          }}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <LoadingSpinner className="h-4 w-4" />}
          {!busy && 'Continue with Google'}
        </button>
      </div>

      <p className="text-xs text-white/45">Have a meeting link? Just open it — you don&apos;t need an account to join.</p>
    </div>
  );
}

function HostDashboard({ userName, onSignOut }: { userName: string; onSignOut: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
    [router, userName],
  );

  // "Instant" button — create a room and jump straight into the call.
  async function handleInstant() {
    if (busy) return;
    setBusy(true);
    try {
      enterAsHost(await api.createRoom());
    } catch (e) {
      setBusy(false);
      surface(e);
    }
  }

  async function handleSchedule(iso: string) {
    if (!iso || busy) return;
    setBusy(true);
    try {
      await api.createRoom({ scheduledStart: iso });
      refresh();
    } catch (e) {
      surface(e);
    } finally {
      setBusy(false);
    }
  }

  async function startRoom(slug: string) {
    try {
      enterAsHost(await api.hostJoin(slug));
    } catch (e) {
      surface(e);
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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleInstant}
          disabled={busy}
          className="neon-magenta flex flex-1 items-center justify-center gap-2 rounded-lg bg-magenta px-4 py-2.5 font-display font-semibold tracking-wide text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? <LoadingSpinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {!busy && 'Instant'}
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
  const [starting, setStarting] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/rooms/${encodeURIComponent(room.room)}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await Promise.resolve(onStart());
    } finally {
      setStarting(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-white/90">{room.scheduledStart ? new Date(room.scheduledStart).toLocaleString() : 'Anytime'}</p>
          <p className="font-mono text-xs text-cyan/80">{room.room}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            icon={copied ? Check : Copy}
            label={copied ? 'Copied!' : 'Copy meeting link'}
            className="text-white/70 hover:bg-white/15 hover:text-white"
            onClick={copy}
            disabled={starting}
          />
          <button
            type="button"
            disabled={starting}
            onClick={handleStart}
            className="inline-flex items-center justify-center gap-1.5 h-8 w-8 rounded-md bg-cyan text-black transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/30 disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Start meeting"
            title="Start meeting"
          >
            {starting ? <LoadingSpinner className="h-4 w-4" /> : <Play className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </li>
  );
}
