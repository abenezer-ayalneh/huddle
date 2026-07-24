'use client';

import { MousePointer2, ShieldAlert } from 'lucide-react';
import type { RemoteControlSession } from '@/lib/controlProtocol';

export default function RemoteControlStatus({
  session,
  iAmSharer,
  iAmController,
  recordingActive,
  renewalRemainingMs,
  onStop,
  onRenew,
}: {
  session: RemoteControlSession;
  iAmSharer: boolean;
  iAmController: boolean;
  recordingActive: boolean;
  renewalRemainingMs: number | null;
  onStop: () => void;
  onRenew: () => void;
}) {
  const minutes = renewalRemainingMs == null ? null : Math.ceil(renewalRemainingMs / 60_000);
  const active = session.agentConnected;

  const relationship = iAmController
    ? `Controlling ${session.sharerName}`
    : iAmSharer
      ? `${session.controllerName} is controlling your desktop`
      : `${session.controllerName} is controlling ${session.sharerName}'s desktop`;

  const waiting = iAmController
    ? `Waiting for ${session.sharerName} to start the Control Agent`
    : iAmSharer
      ? `Control approved for ${session.controllerName} · Start the Control Agent`
      : `Waiting for ${session.sharerName}'s Control Agent`;

  return (
    <section
      aria-label="Remote Control status"
      aria-live="polite"
      className="glass-strong pointer-events-auto w-full overflow-hidden rounded-xl shadow-[0_12px_36px_oklch(0_0_0/0.35)] ring-1 ring-cyan/30"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:px-4">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/12 text-cyan ring-1 ring-cyan/25">
          <MousePointer2 className="h-4 w-4" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[oklch(0.17_0.025_285)] ${active ? 'bg-cyan' : 'animate-pulse bg-amber-300'}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white/95">{active ? relationship : waiting}</p>
          <p className="text-xs text-white/55">{active ? 'Remote Control active' : 'Remote Control approved · desktop not yet shared'}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {iAmSharer && minutes != null && (
            <button
              type="button"
              onClick={onRenew}
              className="inline-flex h-9 items-center rounded-lg bg-cyan/15 px-3 text-xs font-semibold text-cyan ring-1 ring-cyan/35 transition hover:bg-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70"
            >
              Reconfirm{minutes <= 5 ? ` · ${minutes}m` : ''}
            </button>
          )}
          {(iAmSharer || iAmController) && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex h-9 items-center rounded-lg bg-magenta/15 px-3 text-xs font-semibold text-magenta ring-1 ring-magenta/35 transition hover:bg-magenta/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/70"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {recordingActive && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-amber-200/15 bg-amber-200/5 px-3 py-2 text-xs text-amber-100/90 sm:items-center sm:px-4"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200 sm:mt-0" />
          The controlled desktop is visible to the room and may be included in the active Recording.
        </div>
      )}
    </section>
  );
}
