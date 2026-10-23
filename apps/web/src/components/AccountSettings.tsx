'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import AvatarEditor from './AvatarEditor';
import './AccountSettings.css';
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
  const popup = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
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

  useEffect(() => {
    if (popup.current) popup.current.scrollTop = 0;
    if (!imageFile) uploadInput.current?.focus();
  }, [imageFile]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
      return true;
    } catch (reason) {
      if (isFaultError(reason)) emitFault(reason.fault);
      setError(reason instanceof Error ? reason.message : 'The account request failed.');
      return false;
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
    const saved = await run(async () => {
      const result = await api.uploadAvatar(file);
      setBrokenImage(null);
      setProfile((current) => (current ? { ...current, image: result.image } : current));
      setMessage('Profile picture updated.');
    });
    if (saved) setImageFile(null);
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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy && !imagePreparing) {
          if (imageFile) {
            setImageFile(null);
            setError('');
          } else onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="account-settings-backdrop" />
        <Dialog.Popup ref={popup} className="lobby-dialog account-settings" aria-busy={busy || imagePreparing}>
          <header className="account-settings-header">
            <div>
              <Dialog.Title className="account-settings-title">{imageFile ? 'Adjust profile picture' : 'Account settings'}</Dialog.Title>
              <Dialog.Description className="account-settings-description">
                {imageFile ? 'Choose how your picture appears across Huddle.' : 'Manage your Huddle identity and sign-in methods.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={busy || imagePreparing}
              aria-label={imageFile ? 'Cancel image adjustment' : 'Close account settings'}
              className="account-settings-close"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>

          {imageFile && (
            <AvatarEditor
              file={imageFile}
              busy={busy}
              onWorkingChange={setImagePreparing}
              onApply={upload}
              onCancel={() => {
                setImageFile(null);
                setError('');
              }}
            />
          )}
          {!imageFile && !profile && !error && (
            <p role="status" className="py-5 text-sm account-muted">
              Loading account…
            </p>
          )}
          {!imageFile && profile && (
            <div className="account-settings-sections">
              <form onSubmit={saveName} className="space-y-3">
                <label className="block text-sm font-medium" htmlFor="account-display-name">
                  Display name
                </label>
                <div className="account-field-row">
                  <input
                    id="account-display-name"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    className="account-field min-w-0 flex-1"
                  />
                  <button type="submit" disabled={busy || !name.trim()} className="account-button account-button-primary">
                    Save
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <p className="text-sm font-medium">Profile picture</p>
                <div className="flex flex-wrap items-center gap-3">
                  {profile.image && profile.image !== brokenImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- profile uploads and Google avatars are served from user/API origins.
                    <img
                      src={profile.image}
                      alt="Profile"
                      onError={() => setBrokenImage(profile.image)}
                      className="size-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div aria-hidden="true" className="account-avatar-placeholder flex size-14 shrink-0 items-center justify-center rounded-full text-lg">
                      {profile.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <label className="account-button account-upload">
                    Upload image
                    <input
                      type="file"
                      ref={uploadInput}
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        setError('');
                        setMessage('');
                        if (file) {
                          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) setError('Choose a JPEG, PNG, or WebP image.');
                          else if (file.size > 5 * 1024 * 1024) setError('Choose an image no larger than 5 MiB.');
                          else setImageFile(file);
                        }
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {profile.image && (
                    <button type="button" disabled={busy} onClick={() => void removeAvatar()} className="account-button">
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs account-muted">JPEG, PNG, or WebP up to 5 MiB.</p>
              </div>

              <form onSubmit={changeEmail} className="space-y-3 border-t account-divider pt-5">
                <label className="block text-sm font-medium" htmlFor="account-email">
                  Email {profile.emailVerified ? <span className="account-verified">· verified</span> : <span className="account-attention">· unverified</span>}
                </label>
                <div className="account-field-row">
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="account-field min-w-0 flex-1"
                  />
                  <button type="submit" disabled={busy || !email.trim() || email.trim() === profile.email} className="account-button">
                    Change
                  </button>
                </div>
                <p className="text-xs account-muted">The new address takes effect after you confirm the verification email.</p>
              </form>

              <form onSubmit={savePassword} className="space-y-3 border-t account-divider pt-5">
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
                    className="account-field w-full"
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
                      className="account-field w-full"
                    />
                    <button type="submit" disabled={busy || newPassword.length < 8 || !currentPassword} className="account-button">
                      Change password
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs account-muted">
                      We’ll email a one-hour setup link to your verified address. Sign in again within 10 minutes before deleting your account.
                    </p>
                    <button type="submit" disabled={busy || !profile.emailVerified} className="account-button">
                      Email password setup link
                    </button>
                  </>
                )}
              </form>

              <form onSubmit={deleteAccount} className="space-y-3 border-t account-divider pt-5">
                <h3 className="text-sm font-semibold account-danger">Delete account</h3>
                <p className="text-xs leading-5 account-muted">
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
                    className="account-field w-full"
                  />
                )}
                <input
                  aria-label="Type DELETE to confirm"
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="account-field w-full"
                />
                <button
                  type="submit"
                  disabled={busy || deleteText !== 'DELETE' || (profile.hasPassword && !deletePassword)}
                  className="account-button account-button-danger"
                >
                  Delete account
                </button>
              </form>
            </div>
          )}

          {message && (
            <p role="status" className="mt-4 text-sm account-success">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm account-danger">
              {error}
            </p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
