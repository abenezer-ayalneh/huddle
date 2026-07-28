'use client';

import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

// Shown only in the actual active call. It never exposes a participant list or
// an account email through room metadata: the API derives both from the signed
// session and the caller's opaque LiveKit token binding.
export default function RecordingShareConsent({
  room,
  participantToken,
  isHost,
  available,
}: {
  room: string;
  participantToken: string;
  isHost: boolean;
  available: boolean;
}) {
  const { data: session } = useSession();
  const [state, setState] = useState<'idle' | 'sending' | 'accepted'>('idle');

  if (!available || isHost || !session || state === 'accepted') return null;

  return (
    <div className="pointer-events-auto glass-strong max-w-md rounded-xl px-4 py-3 shadow-[0_4px_30px_oklch(0_0_0/0.4)] animate-in fade-in slide-in-from-top-2 duration-200">
      <p className="text-sm font-medium text-white">Get this recording in Google Drive?</p>
      <p className="mt-1 text-xs leading-5 text-white/65">
        If you opt in, Huddle may grant the email on your signed-in account reader access to eligible recordings in the host&apos;s private Drive. This choice
        is final for this call.
      </p>
      <button
        type="button"
        disabled={state === 'sending'}
        onClick={async () => {
          setState('sending');
          try {
            await api.recordingShareConsent(room, participantToken);
            setState('accepted');
          } catch {
            setState('idle');
          }
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'sending' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
        {state === 'sending' ? 'Saving…' : 'I consent'}
      </button>
    </div>
  );
}
