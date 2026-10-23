'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authPost } from '@/lib/auth-client';

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const invalidLink = searchParams.get('error') === 'INVALID_TOKEN';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(invalidLink ? 'This password link is invalid or has expired. Request a new link from account settings.' : '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError('This password link is missing its token. Request a new link from account settings.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authPost('/reset-password', { token, newPassword: password });
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The password could not be set. Request a new link and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1015] p-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/15 bg-[#10151b] p-6 shadow-2xl sm:p-8" aria-labelledby="reset-password-title">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Account security</p>
        <h1 id="reset-password-title" className="mt-3 text-2xl font-semibold">
          Set your Huddle password
        </h1>
        {complete ? (
          <div className="mt-5 space-y-4">
            <p role="status" className="text-sm leading-6 text-emerald-200">
              Your password is set. For security, all active sessions were signed out.
            </p>
            <Link href="/lobby" className="inline-flex rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-white/65">Choose a password with at least 8 characters. This link can only be used once.</p>
            <label className="block space-y-2 text-sm">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-200">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !token || password.length < 8 || password !== confirmation}
              className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Set password'}
            </button>
            <Link href="/lobby" className="block text-center text-sm text-white/60 hover:text-white">
              Back to lobby
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
