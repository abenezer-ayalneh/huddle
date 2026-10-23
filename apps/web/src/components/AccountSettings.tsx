'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, isFaultError } from '@/lib/api';
import { authClient, authPost, signOut } from '@/lib/auth-client';
import { emitFault } from '@/lib/faults';

export default function AccountSettings({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof api.getProfile>> | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getProfile()
      .then((value) => {
        setProfile(value);
        setName(value.name);
        setEmail(value.email);
      })
      .catch((reason: unknown) => {
        if (isFaultError(reason)) emitFault(reason.fault);
        setError(reason instanceof Error ? reason.message : 'Could not load account settings.');
      });
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
    } catch (reason) {
      if (isFaultError(reason)) emitFault(reason.fault);
      setError(reason instanceof Error ? reason.message : 'The account request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const updated = await api.updateProfile(name);
      setProfile((current) => (current ? { ...current, name: updated.name } : current));
      await authClient.getSession({ query: { disableCookieCache: true } });
      setMessage('Display name updated.');
    });
  }

  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      const result = await api.uploadAvatar(file);
      setBrokenImage(null);
      setProfile((current) => (current ? { ...current, image: result.image } : current));
      setMessage('Profile picture updated.');
    });
  }

  async function removeAvatar() {
    await run(async () => {
      await api.removeAvatar();
      setProfile((current) => (current ? { ...current, image: null } : current));
      setMessage('Profile picture removed.');
    });
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await authPost('/change-email', { newEmail: email.trim(), callbackURL: window.location.href });
      setMessage('Check your email to confirm the address change.');
    });
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (profile?.hasPassword) {
        await authPost('/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
        setCurrentPassword('');
        setNewPassword('');
        setMessage('Password changed and other sessions signed out.');
      } else {
        await authPost('/request-password-reset', {
          email: profile!.email,
          redirectTo: new URL('/reset-password', window.location.origin).toString(),
        });
        setMessage('Check your verified email for a password setup link. It expires in one hour.');
      }
    });
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api.deleteAccount(deleteText, profile?.hasPassword ? deletePassword : undefined);
      try {
        await signOut();
      } finally {
        // The API has already revoked every stored session; always leave the
        // settings surface even if clearing this browser's cookie fails.
        window.location.assign('/lobby?account=deleting');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#10151b] p-5 text-white shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-title" className="text-xl font-semibold">
              Account settings
            </h2>
            <p className="mt-1 text-sm text-white/65">Manage your Huddle identity and sign-in methods.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close account settings" className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10">
            ✕
          </button>
        </header>

        {!profile && !error && (
          <p role="status" className="py-5 text-sm text-white/65">
            Loading account…
          </p>
        )}
        {profile && (
          <div className="space-y-6">
            <form onSubmit={saveName} className="space-y-3">
              <label className="block text-sm font-medium" htmlFor="account-display-name">
                Display name
              </label>
              <div className="flex gap-2">
                <input
                  id="account-display-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <p className="text-sm font-medium">Profile picture</p>
              <div className="flex items-center gap-4">
                {profile.image && profile.image !== brokenImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- profile uploads and Google avatars are served from user/API origins.
                  <img src={profile.image} alt="Profile" onError={() => setBrokenImage(profile.image)} className="size-14 rounded-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-white/10 text-lg">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <label className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
                  Upload image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      void upload(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {profile.image && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeAvatar()}
                    className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-white/50">JPEG, PNG, or WebP up to 5 MiB.</p>
            </div>

            <form onSubmit={changeEmail} className="space-y-3 border-t border-white/10 pt-5">
              <label className="block text-sm font-medium" htmlFor="account-email">
                Email {profile.emailVerified ? <span className="text-emerald-300">· verified</span> : <span className="text-amber-300">· unverified</span>}
              </label>
              <div className="flex gap-2">
                <input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !email.trim() || email.trim() === profile.email}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Change
                </button>
              </div>
              <p className="text-xs text-white/50">The new address takes effect after you confirm the verification email.</p>
            </form>

            <form onSubmit={savePassword} className="space-y-3 border-t border-white/10 pt-5">
              <h3 className="text-sm font-medium">{profile.hasPassword ? 'Change password' : 'Add a password'}</h3>
              {profile.hasPassword && (
                <input
                  aria-label="Current password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
                />
              )}
              {profile.hasPassword ? (
                <>
                  <input
                    aria-label="New password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password (at least 8 characters)"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                    className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || newPassword.length < 8 || !currentPassword}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Change password
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/50">
                    We’ll email a one-hour setup link to your verified address. Sign in again within 10 minutes before deleting your account.
                  </p>
                  <button
                    type="submit"
                    disabled={busy || !profile.emailVerified}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Email password setup link
                  </button>
                </>
              )}
            </form>

            <form onSubmit={deleteAccount} className="space-y-3 border-t border-red-400/25 pt-5">
              <h3 className="text-sm font-semibold text-red-200">Delete account</h3>
              <p className="text-xs leading-5 text-white/60">
                Your rooms, Huddle recordings, and profile image will be removed. Copies already delivered to Google Drive stay in your Drive. Cleanup may
                continue after you are signed out.
              </p>
              {profile.hasPassword && (
                <input
                  aria-label="Password to confirm deletion"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Current password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
                />
              )}
              <input
                aria-label="Type DELETE to confirm"
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || deleteText !== 'DELETE' || (profile.hasPassword && !deletePassword)}
                className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40 disabled:opacity-40"
              >
                Delete account
              </button>
            </form>
          </div>
        )}

        {message && (
          <p role="status" className="mt-4 text-sm text-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-200">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
