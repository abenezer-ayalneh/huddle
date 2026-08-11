'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Check, Copy, LogOut, MailCheck, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, isFaultError, type RoomSummary } from '@/lib/api';
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';
import { emitFault } from '@/lib/faults';
import { saveHostSession } from '@/lib/hostSession';
import DateTimePicker from '@/components/DateTimePicker';
import IconButton from '@/components/IconButton';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Auth/dashboard card. Rendered inside the server-component lobby shell so only
// this interactive island ships as a client bundle.
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
const inputClass = 'lobby-input';

function SignIn() {
  const callbackURL = typeof window !== 'undefined' ? `${window.location.origin}/lobby` : undefined;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  // Surface an OAuth failure bounced back via ?error=… (BetterAuth redirects
  // here when we pass errorCallbackURL). Strip the param afterwards so a refresh
  // doesn't keep re-showing it.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (!code) return;
    window.history.replaceState(null, '', window.location.pathname);
    setTimeout(() => setError(oauthErrorMessage(code)), 0);
  }, []);

  const canSubmit = email.trim() && password.length >= 8 && (mode === 'signin' || name.trim()) && !busy;

  async function submit() {
    if (!canSubmit) return;
    const submittedEmail = email.trim();
    setBusy(true);
    setError(null);
    const result =
      mode === 'signup'
        ? await signUp.email({
            name: name.trim(),
            email: submittedEmail,
            password,
          })
        : await signIn.email({ email: submittedEmail, password });
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
      return;
    }
    if (mode === 'signup') {
      setEmail(submittedEmail);
      setVerificationEmail(submittedEmail);
    }
  }

  function closeVerificationDialog() {
    setVerificationEmail(null);
    setMode('signin');
    setName('');
    setPassword('');
    setError(null);
  }

  return (
    <>
      <div className="lobby-auth">
        <div className="lobby-panel-heading">
          <p className="lobby-panel-eyebrow">HOST ACCESS</p>
          <h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p>
            {mode === 'signup' ? 'Create an account to host or schedule a meeting.' : 'Sign in to host or schedule a meeting.'}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="lobby-form"
        >
          {mode === 'signup' && (
            <div className="lobby-field">
              <label htmlFor="lobby-name">Display name</label>
              <input id="lobby-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
            </div>
          )}
          <div className="lobby-field">
            <label htmlFor="lobby-email">Email</label>
            <input id="lobby-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
          </div>
          <div className="lobby-field">
            <label htmlFor="lobby-password">Password</label>
            <input
              id="lobby-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className={inputClass}
            />
          </div>

          {error && <p className="lobby-form-error">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="lobby-primary-button lobby-primary-button-full"
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
          className="lobby-text-action"
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>

        <div className="lobby-auth-divider">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL });
            }}
            className="lobby-secondary-button lobby-secondary-button-full"
          >
            {busy && <LoadingSpinner className="h-4 w-4" />}
            {!busy && 'Continue with Google'}
          </button>
        </div>

        <p className="lobby-legal-copy">
          By signing in or creating an account, you agree to the{' '}
          <Link href="/terms">
            Terms of Service
          </Link>{' '}
          and acknowledge the{' '}
          <Link href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="lobby-guest-note">Have a meeting link? Open it directly. You do not need an account to join.</p>
      </div>

      <AlertDialog open={verificationEmail !== null} onOpenChange={(open) => !open && closeVerificationDialog()}>
        <AlertDialogContent className="lobby-dialog">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-cyan/15 text-cyan">
              <MailCheck />
            </AlertDialogMedia>
            <AlertDialogTitle>Check your email</AlertDialogTitle>
            <AlertDialogDescription>
              We sent a verification link to {verificationEmail}. Open it to finish setting up your Huddle account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeVerificationDialog}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
    <div className="lobby-dashboard">
      <header className="lobby-dashboard-header">
        <div>
          <p className="lobby-panel-eyebrow">HOST CONSOLE</p>
          <h2>Your rooms</h2>
          <p>Signed in as {userName}</p>
        </div>
        <IconButton icon={LogOut} label="Sign out" className="lobby-icon-button" onClick={onSignOut} />
      </header>

      <div className="lobby-room-actions">
        <button
          type="button"
          onClick={handleInstant}
          disabled={busy}
          className="lobby-primary-button"
        >
          {busy ? <LoadingSpinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {!busy && 'Instant'}
        </button>

        <DateTimePicker
          onSchedule={handleSchedule}
          disabled={busy}
          triggerClassName="lobby-secondary-button"
        >
          <span>Schedule</span>
          <Calendar size={16} />
        </DateTimePicker>
      </div>

      <MeetingList rooms={rooms} onStart={startRoom} />

      <Link href="/recordings" className="lobby-recordings-link">
        View past recordings
      </Link>
    </div>
  );
}

function MeetingList({ rooms, onStart }: { rooms: RoomSummary[] | null; onStart: (slug: string) => void }) {
  if (rooms === null) return null;
  if (rooms.length === 0) {
    return <p className="lobby-empty-state">No upcoming scheduled meetings.</p>;
  }
  return (
    <div className="lobby-meeting-list">
      <h3>
        Upcoming meetings
      </h3>
      <ul>
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
    <li className="lobby-meeting-row">
      <div className="lobby-meeting-row-content">
        <div className="lobby-meeting-meta">
          <p>{room.scheduledStart ? new Date(room.scheduledStart).toLocaleString() : 'Anytime'}</p>
          <p>{room.room}</p>
        </div>
        <div className="lobby-meeting-actions">
          <IconButton
            icon={copied ? Check : Copy}
            label={copied ? 'Copied!' : 'Copy meeting link'}
            className="lobby-icon-button"
            onClick={copy}
            disabled={starting}
          />
          <button
            type="button"
            disabled={starting}
            onClick={handleStart}
            className="lobby-start-button"
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
