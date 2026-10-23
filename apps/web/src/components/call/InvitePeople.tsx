'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function InvitePeople({ room, hostKey }: { room: string; hostKey: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <form
      className="mt-3 flex flex-col gap-2 text-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setNotice('');
        try {
          await api.invite(room, hostKey, email.trim());
          setNotice('Invitation accepted by the email provider.');
          setEmail('');
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Could not send invitation. Try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-1">
        Invite by email
        <input
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 rounded-md border border-current/25 bg-transparent px-3 py-2"
          placeholder="person@example.com"
        />
      </label>
      <button type="submit" disabled={busy || !email.trim()} className="rounded-md border border-current/25 px-3 py-2 disabled:opacity-50">
        {busy ? 'Sending…' : 'Send invitation'}
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
