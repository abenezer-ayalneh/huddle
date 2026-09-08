'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import MaintenanceShell from '@/components/maintenance/MaintenanceShell';
import styles from '@/components/maintenance/maintenance.module.css';
import { maintenanceRequest, type MaintenanceStatus } from '@/lib/maintenance';
import { signIn, signOut, useSession } from '@/lib/auth-client';

export default function MaintenanceAdmin() {
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await maintenanceRequest<MaintenanceStatus>('admin');
      setStatus(next);
      setError('');
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : 'Could not load maintenance.');
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [session, refresh]);
  async function change(enabled: boolean) {
    setBusy(true);
    setError('');
    try {
      const next = await maintenanceRequest<MaintenanceStatus>('admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, message: message ?? status?.message }),
      });
      setStatus(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update maintenance.');
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      const result = await signIn.email({ email: String(values.get('email')), password: String(values.get('password')) });
      if (result.error) setError(result.error.message || 'Could not sign in.');
    } catch {
      setError('Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <MaintenanceShell>
      <span className={styles.status}>Owner controls</span>
      <h1>Make room for maintenance.</h1>
      {isPending ? (
        <p role="status">Checking your session…</p>
      ) : !session ? (
        <>
          <p>Sign in with the owner account to manage Huddle.</p>
          <form onSubmit={login}>
            <label htmlFor="owner-email">Email</label>
            <input id="owner-email" name="email" type="email" autoComplete="username" required />
            <label htmlFor="owner-password">Password</label>
            <input id="owner-password" name="password" type="password" autoComplete="current-password" required />
            <div className={styles.actions}>
              <button className={styles.button} disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                disabled={busy}
                onClick={() =>
                  void signIn
                    .social({ provider: 'google', callbackURL: `${window.location.origin}/admin/maintenance` })
                    .catch(() => setError('Google sign-in is unavailable. Try email and password.'))
                }
              >
                Continue with Google
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          {status && (
            <>
              <div className={styles.detail} aria-live="polite">
                <strong>
                  {status.phase === 'off' ? 'Huddle is open' : status.phase === 'scheduled' ? 'Maintenance is scheduled' : 'Maintenance is active'}
                </strong>
                <p>
                  {status.phase === 'scheduled' && status.startsAt
                    ? `Meetings end at ${new Date(status.startsAt).toLocaleTimeString()}. Participants have been given a five-minute warning.`
                    : status.phase === 'active'
                      ? 'New meetings and joins are paused. The server is ending active calls.'
                      : 'Starting maintenance pauses new meetings and joins immediately. Everyone in a call sees a warning, then meetings end after five minutes.'}
                </p>
              </div>
              {status.phase === 'off' && (
                <>
                  <label htmlFor="maintenance-message">Message for visitors</label>
                  <textarea id="maintenance-message" maxLength={500} value={message ?? status.message} onChange={(e) => setMessage(e.target.value)} />
                </>
              )}
              <div className={styles.actions}>
                <button className={styles.button} disabled={busy} onClick={() => void change(status.phase === 'off')}>
                  {busy
                    ? 'Saving…'
                    : status.phase === 'off'
                      ? 'Start five-minute warning'
                      : status.phase === 'scheduled'
                        ? 'Cancel maintenance'
                        : 'Reopen Huddle'}
                </button>
                <Link href="/maintenance" className={`${styles.button} ${styles.secondary}`} target="_blank" rel="noopener noreferrer">
                  View visitor page
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
          <div className={styles.actions}>
            <Link href="/lobby">Back to lobby</Link>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </MaintenanceShell>
  );
}
