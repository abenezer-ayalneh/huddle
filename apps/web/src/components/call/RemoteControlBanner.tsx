'use client';

import { useRemoteParticipants } from '@livekit/components-react';
import { ChevronDown, MousePointer2 } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isAgentIdentity } from '@/lib/controlProtocol';
import type { ControlRequest, Controlling } from './useRemoteControl';

// Persistent Remote Control ribbons. While a session is live both sides keep
// an always-visible indicator: the presenter can Revoke instantly (no
// confirmation — see CONTEXT.md), the controller can Release. A presenter
// whose controllable share has no controller yet gets the Offer Control picker.

export default function RemoteControlBanner({
  iAmControllablePresenter,
  controller,
  controlling,
  canRequest,
  onRequest,
  onRevoke,
  onRelease,
  onOffer,
}: {
  iAmControllablePresenter: boolean;
  controller: ControlRequest | null;
  controlling: Controlling | null;
  // Viewer of a controllable share with no pending ask — may request control.
  canRequest: boolean;
  onRequest: () => void;
  onRevoke: () => void;
  onRelease: () => void;
  onOffer: (targetId: string, targetName: string) => void;
}) {
  if (controlling) {
    return (
      <Ribbon tone="cyan">
        <MousePointer2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          You&apos;re controlling <strong>{controlling.presenterName}</strong>&apos;s screen
        </span>
        <RibbonButton onClick={onRelease}>Release</RibbonButton>
      </Ribbon>
    );
  }

  if (iAmControllablePresenter && controller) {
    return (
      <Ribbon tone="magenta">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-magenta" />
        <span>
          <strong>{controller.requesterName}</strong> is controlling your screen
        </span>
        <RibbonButton onClick={onRevoke}>Revoke</RibbonButton>
      </Ribbon>
    );
  }

  if (iAmControllablePresenter) {
    return (
      <Ribbon tone="cyan">
        <MousePointer2 className="h-3.5 w-3.5 shrink-0" />
        <span>Remote control ready</span>
        <OfferPicker onOffer={onOffer} />
      </Ribbon>
    );
  }

  if (canRequest) {
    return (
      <Ribbon tone="cyan">
        <MousePointer2 className="h-3.5 w-3.5 shrink-0" />
        <RibbonButton onClick={onRequest}>Request control</RibbonButton>
      </Ribbon>
    );
  }

  return null;
}

// Participant picker for Offer Control. Agents are plumbing, never people —
// filter them out of the list.
function OfferPicker({ onOffer }: { onOffer: (targetId: string, targetName: string) => void }) {
  const [open, setOpen] = useState(false);
  const participants = useRemoteParticipants().filter((p) => !isAgentIdentity(p.identity));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex items-center gap-1 rounded-lg bg-cyan/15 px-3 py-1 text-xs font-medium text-cyan ring-1 ring-cyan/40 transition-all hover:bg-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60">
        Offer control <ChevronDown className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent side="bottom" sideOffset={8} className="glass-strong w-56 gap-1 rounded-xl p-1.5">
        {participants.length === 0 ? (
          <p className="px-2.5 py-1.5 text-sm text-white/40">No one else is here yet</p>
        ) : (
          participants.map((p) => (
            <button
              key={p.identity}
              type="button"
              onClick={() => {
                setOpen(false);
                onOffer(p.identity, p.name || p.identity);
              }}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
            >
              <span className="truncate">{p.name || p.identity}</span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function Ribbon({ children, tone }: { children: React.ReactNode; tone: 'cyan' | 'magenta' }) {
  const ring = tone === 'magenta' ? 'ring-magenta/40' : 'ring-cyan/40';
  return (
    <div
      role="status"
      className={`pointer-events-auto glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/90 ring-1 ${ring} shadow-[0_4px_30px_oklch(0_0_0/0.4)] animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      {children}
    </div>
  );
}

function RibbonButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-white/8 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15 transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
    >
      {children}
    </button>
  );
}
