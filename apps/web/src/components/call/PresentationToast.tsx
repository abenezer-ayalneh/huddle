'use client';

import { Check, Loader2, X } from 'lucide-react';
import type { IncomingRequest, OutgoingRequest, PresentationOutcome } from './usePresentation';

export default function PresentationToast({
  outgoing,
  incoming,
  outcome,
  onCancel,
  onYield,
  onDecline,
  onDismissOutcome,
}: {
  outgoing: OutgoingRequest | null;
  incoming: IncomingRequest | null;
  outcome: PresentationOutcome | null;
  onCancel: () => void;
  onYield: () => void;
  onDecline: () => void;
  onDismissOutcome: () => void;
}) {
  if (incoming) {
    return (
      <Toast>
        <span className="text-sm text-white/90">
          <strong className="text-cyan">{incoming.requesterName}</strong> wants to present
        </span>
        <div className="flex gap-2">
          <ToastButton onClick={onYield} variant="accept">
            <Check className="h-3.5 w-3.5" /> Allow
          </ToastButton>
          <ToastButton onClick={onDecline} variant="decline">
            <X className="h-3.5 w-3.5" /> Decline
          </ToastButton>
        </div>
      </Toast>
    );
  }

  if (outgoing) {
    return (
      <Toast>
        <span className="flex items-center gap-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          Waiting for <strong className="text-cyan">{outgoing.presenterName}</strong> to respond…
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

function outcomeText(o: PresentationOutcome): string {
  switch (o.kind) {
    case 'declined':
      return `${o.name} declined your request.`;
    case 'timed-out':
      return `${o.name} didn't respond. Try again later.`;
    case 'yielded':
      return `${o.name} yielded — you're presenting now.`;
    case 'force-taken':
      return 'The host started presenting.';
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
