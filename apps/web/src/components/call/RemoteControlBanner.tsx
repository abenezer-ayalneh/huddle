'use client';

import { MousePointer2, ShieldAlert } from 'lucide-react';
import type { RemoteControlSession } from '@/lib/controlProtocol';

export default function RemoteControlBanner({
  session,
  iAmSharer,
  iAmController,
  recordingActive,
  renewalRemainingMs,
  onStop,
  onRenew,
}: {
  session: RemoteControlSession | null;
  iAmSharer: boolean;
  iAmController: boolean;
  recordingActive: boolean;
  renewalRemainingMs: number | null;
  onStop: () => void;
  onRenew: () => void;
}) {
  if (!session) return null;
  const minutes = renewalRemainingMs == null ? null : Math.ceil(renewalRemainingMs / 60_000);
  return (
    <div className="pointer-events-auto flex max-w-[min(92vw,48rem)] flex-col gap-2 rounded-2xl bg-black/70 px-4 py-3 text-sm text-white/90 ring-1 ring-cyan/35 backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <MousePointer2 className="h-4 w-4 shrink-0 text-cyan" />
        <span>
          Remote Control {session.agentConnected ? 'active' : 'waiting for Control Agent'} · <strong>{session.controllerName}</strong> controls{' '}
          <strong>{session.sharerName}</strong>&apos;s desktop
        </span>
        {(iAmSharer || iAmController) && (
          <button type="button" onClick={onStop} className="rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Stop
          </button>
        )}
        {iAmSharer && minutes != null && (
          <button type="button" onClick={onRenew} className="rounded-lg bg-cyan/15 px-3 py-1 text-xs text-cyan ring-1 ring-cyan/35 hover:bg-cyan/25">
            Reconfirm{minutes <= 5 ? ` (${minutes}m)` : ''}
          </button>
        )}
      </div>
      {recordingActive && (
        <div role="alert" className="flex items-center justify-center gap-2 text-xs text-amber-200">
          <ShieldAlert className="h-3.5 w-3.5" /> The controlled desktop is visible to the room and may be included in the active Recording.
        </div>
      )}
    </div>
  );
}
