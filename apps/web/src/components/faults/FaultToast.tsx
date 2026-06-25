'use client';

import { AlertTriangle, RotateCw, X } from 'lucide-react';
import { dismissFault, useFaults, type ActiveFault } from '@/lib/faults';
import { recoveryActionFor, type RecoveryAction } from '@/lib/faultCodes';

// The single general Fault surface for user-initiated faults (docs/adr/0017,
// 0019). Faults are already deduped by code in the store; here we just render
// the queue, each with a code-driven recovery action. Bottom-center so it never
// collides with the top-center in-call toasts (presentation / record / connect).
export default function FaultToast() {
  const faults = useFaults();
  if (faults.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {faults.map((fault) => (
        <FaultRow key={fault.id} fault={fault} />
      ))}
    </div>
  );
}

function FaultRow({ fault }: { fault: ActiveFault }) {
  const action = recoveryActionFor(fault.code);

  return (
    <div
      role="alert"
      className="pointer-events-auto glass-strong flex max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-[0_4px_30px_oklch(0_0_0/0.4)] ring-1 ring-destructive/30 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <span className="text-sm text-white/90">{fault.message}</span>
      <div className="ml-auto flex items-center gap-1.5">
        {action !== 'none' && <RecoveryButton action={action} />}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismissFault(fault.id)}
          className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function RecoveryButton({ action }: { action: RecoveryAction }) {
  const { label, run } = recovery(action);
  return (
    <button
      type="button"
      onClick={run}
      className="flex items-center gap-1 rounded-lg bg-cyan/15 px-3 py-1.5 text-xs font-medium text-cyan ring-1 ring-cyan/40 transition-all hover:bg-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
    >
      {action === 'retry' && <RotateCw className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

// We don't capture the originating request, so "retry"/"reload" re-run the page
// (which re-attempts its data) and "signin" sends the user to the lobby to
// re-authenticate. Honest, simple recovery (docs/adr/0019).
function recovery(action: RecoveryAction): { label: string; run: () => void } {
  switch (action) {
    case 'signin':
      return { label: 'Sign in', run: () => window.location.assign('/') };
    case 'retry':
      return { label: 'Retry', run: () => window.location.reload() };
    case 'reload':
    default:
      return { label: 'Reload', run: () => window.location.reload() };
  }
}
