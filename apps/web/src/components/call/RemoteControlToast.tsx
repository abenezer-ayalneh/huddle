'use client';

import { Check, MousePointer2, X } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { RemoteControlRequestSummary } from '@/lib/api';
import type { RemoteControlNotice } from './useRemoteControl';

export default function RemoteControlToast({
  incoming,
  outgoing,
  notice,
  recordingActive,
  onApprove,
  onDeny,
  onDismiss,
}: {
  incoming: RemoteControlRequestSummary | null;
  outgoing: RemoteControlRequestSummary | null;
  notice: RemoteControlNotice | null;
  recordingActive: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onDismiss: () => void;
}) {
  if (incoming) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="signal-call-remote-consent pointer-events-auto flex max-w-[min(94vw,34rem)] flex-col gap-3 rounded-2xl bg-black/80 p-4 text-white ring-1 ring-magenta/50 backdrop-blur"
      >
        <div className="flex items-start gap-3">
          <MousePointer2 className="mt-0.5 h-5 w-5 shrink-0 text-magenta" />
          <div>
            <p className="font-medium">
              <strong className="text-cyan">{incoming.controllerName}</strong> wants to control your desktop.
            </p>
            <p className="mt-1 text-xs text-white/65">
              Everyone in this room will see the desktop. Remote Control includes mouse and keyboard input, plus plain-text clipboard sharing with{' '}
              {incoming.controllerName}.
            </p>
          </div>
        </div>
        {recordingActive && (
          <p role="alert" className="text-xs font-medium text-amber-200">
            Recording is active. The controlled desktop may be recorded.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onDeny} className="signal-call-consent-action rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/75 hover:bg-white/20">
            <X className="mr-1 inline h-3.5 w-3.5" />
            Deny
          </button>
          <button type="button" onClick={onApprove} className="signal-call-consent-action rounded-lg bg-cyan/20 px-3 py-1.5 text-xs text-cyan ring-1 ring-cyan/45 hover:bg-cyan/30">
            <Check className="mr-1 inline h-3.5 w-3.5" />
            Approve
          </button>
        </div>
      </div>
    );
  }
  if (outgoing)
    return (
      <div role="status" className="signal-call-notice-pill pointer-events-auto rounded-full bg-black/75 px-4 py-2 text-sm text-white/85 ring-1 ring-cyan/35">
        <LoadingSpinner aria-hidden="true" className="mr-2 inline h-4 w-4" />
        Waiting for {outgoing.sharerName} to approve Remote Control…
      </div>
    );
  if (!notice) return null;
  return (
    <button
      type="button"
      role="status"
      onClick={onDismiss}
      className={`signal-call-notice-pill pointer-events-auto rounded-full bg-black/75 px-4 py-2 text-sm ring-1 ${notice.tone === 'error' ? 'text-amber-200 ring-amber-300/35' : 'text-white/85 ring-cyan/35'}`}
    >
      {notice.message}
    </button>
  );
}
