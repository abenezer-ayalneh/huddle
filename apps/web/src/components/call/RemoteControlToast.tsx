'use client';

import { Check, Loader2, MousePointer2, X } from 'lucide-react';
import type { ControlOffer, ControlOutcome, ControlRequest } from './useRemoteControl';

// Transient Remote Control prompts, mirroring PresentationToast: incoming
// request (presenter decides), incoming offer (viewer decides), outgoing
// pending states, and short-lived outcomes.

export default function RemoteControlToast({
  incomingRequest,
  incomingOffer,
  outgoingRequest,
  outgoingOffer,
  outcome,
  onGrant,
  onDeclineRequest,
  onAcceptOffer,
  onDeclineOffer,
  onCancelRequest,
  onDismissOutcome,
}: {
  incomingRequest: ControlRequest | null;
  incomingOffer: ControlOffer | null;
  outgoingRequest: ControlOffer | null;
  outgoingOffer: ControlRequest | null;
  outcome: ControlOutcome | null;
  onGrant: () => void;
  onDeclineRequest: () => void;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onCancelRequest: () => void;
  onDismissOutcome: () => void;
}) {
  if (incomingRequest) {
    return (
      <Toast>
        <MousePointer2 className="h-4 w-4 shrink-0 text-magenta" />
        <span className="text-sm text-white/90">
          <strong className="text-cyan">{incomingRequest.requesterName}</strong> wants to control your screen
        </span>
        <div className="flex gap-2">
          <ToastButton onClick={onGrant} variant="accept">
            <Check className="h-3.5 w-3.5" /> Allow
          </ToastButton>
          <ToastButton onClick={onDeclineRequest} variant="decline">
            <X className="h-3.5 w-3.5" /> Decline
          </ToastButton>
        </div>
      </Toast>
    );
  }

  if (incomingOffer) {
    return (
      <Toast>
        <MousePointer2 className="h-4 w-4 shrink-0 text-cyan" />
        <span className="text-sm text-white/90">
          <strong className="text-cyan">{incomingOffer.presenterName}</strong> is offering you control of their screen
        </span>
        <div className="flex gap-2">
          <ToastButton onClick={onAcceptOffer} variant="accept">
            <Check className="h-3.5 w-3.5" /> Take control
          </ToastButton>
          <ToastButton onClick={onDeclineOffer} variant="decline">
            <X className="h-3.5 w-3.5" /> No thanks
          </ToastButton>
        </div>
      </Toast>
    );
  }

  if (outgoingRequest) {
    return (
      <Toast>
        <span className="flex items-center gap-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          Asking <strong className="text-cyan">{outgoingRequest.presenterName}</strong> for control…
        </span>
        <ToastButton onClick={onCancelRequest} variant="decline">
          Cancel
        </ToastButton>
      </Toast>
    );
  }

  if (outgoingOffer) {
    return (
      <Toast>
        <span className="flex items-center gap-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin text-cyan" />
          Offering control to <strong className="text-cyan">{outgoingOffer.requesterName}</strong>…
        </span>
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

function outcomeText(o: ControlOutcome): string {
  switch (o.kind) {
    case 'request-declined':
      return `${o.name} declined your control request.`;
    case 'request-timed-out':
      return `${o.name} didn't respond. Try again later.`;
    case 'offer-declined':
      return `${o.name} declined your control offer.`;
    case 'offer-timed-out':
      return `${o.name} didn't respond to your offer.`;
    case 'revoked':
      return `${o.name} took back control.`;
    case 'released':
      return `${o.name} released control.`;
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
