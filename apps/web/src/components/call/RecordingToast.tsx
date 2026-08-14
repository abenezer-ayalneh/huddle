'use client';

import { Check, X } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { IncomingRecordRequest, RecordOutcome } from './useRecording';

// Request to Record prompts (docs/adr/0011), styled like PresentationToast:
// the host's Approve/Deny on an incoming request, the requester's "waiting"
// state, and the short-lived outcome message.
export default function RecordingToast({
  incoming,
  pending,
  outcome,
  onApprove,
  onDeny,
  onCancel,
  onDismissOutcome,
}: {
  incoming: IncomingRecordRequest | null;
  pending: boolean;
  outcome: RecordOutcome | null;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
  onDismissOutcome: () => void;
}) {
  if (incoming) {
    return (
      <Toast>
        <span className="text-sm text-white/90">
          <strong className="text-cyan">{incoming.requesterName}</strong> wants to record
        </span>
        <div className="flex gap-2">
          <ToastButton onClick={onApprove} variant="accept">
            <Check className="h-3.5 w-3.5" /> Approve
          </ToastButton>
          <ToastButton onClick={onDeny} variant="decline">
            <X className="h-3.5 w-3.5" /> Deny
          </ToastButton>
        </div>
      </Toast>
    );
  }

  if (pending) {
    return (
      <Toast>
        <span className="flex items-center gap-2 text-sm text-white/90">
          <LoadingSpinner aria-hidden="true" className="h-4 w-4" />
          Waiting for the host to approve recording…
        </span>
        <ToastButton onClick={onCancel} variant="decline">
          Cancel
        </ToastButton>
      </Toast>
    );
  }

  if (outcome) {
    return (
      <Toast onClick={onDismissOutcome}>
        <span className="text-sm text-white/90">{outcomeText(outcome)}</span>
      </Toast>
    );
  }

  return null;
}

function outcomeText(o: RecordOutcome): string {
  switch (o.kind) {
    case 'approved':
      return 'The host approved — recording now.';
    case 'denied':
      return 'The host denied your request to record.';
    case 'timed-out':
      return "The host didn't respond. Try again later.";
  }
}

function Toast({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      role="status"
      onClick={onClick}
      className="pointer-events-auto glass-strong flex items-center gap-3 rounded-xl px-4 py-3 shadow-[0_4px_30px_oklch(0_0_0/0.4)] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {children}
    </div>
  );
}

function ToastButton({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: 'accept' | 'decline' }) {
  const tone =
    variant === 'accept' ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/40 hover:bg-cyan/25' : 'bg-white/8 text-white/70 ring-1 ring-white/10 hover:bg-white/15';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 ${tone}`}
    >
      {children}
    </button>
  );
}
