'use client';

import { AlertTriangle, Loader2, RotateCw, WifiOff, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { dismissFault, useApiReachabilityChangedAt, useApiReachable, useFaults, type ActiveFault } from '@/lib/faults';
import { recoveryActionFor, type RecoveryAction } from '@/lib/faultCodes';
import { useCallNoticeState } from '@/lib/systemNotices';

type NoticeTone = 'progress' | 'error' | 'fault';
type SystemNotice = {
  id: string;
  message: string;
  tone: NoticeTone;
  activatedAt: number;
  fault?: ActiveFault;
};

// The single visual family for non-blocking system feedback. Sources retain
// their existing lifecycle: Faults are user-initiated and dismissible, while
// reachability and Call Connection state clear when their source recovers.
export default function SystemNoticeStack() {
  const faults = useFaults();
  const reachable = useApiReachable();
  const apiReachabilityChangedAt = useApiReachabilityChangedAt();
  const { connection, trayOffset } = useCallNoticeState();

  const notices: SystemNotice[] = [
    ...faults.map((fault) => ({
      id: `fault-${fault.id}`,
      message: fault.message,
      tone: 'fault' as const,
      activatedAt: fault.activatedAt,
      fault,
    })),
    ...(!reachable
      ? [
          {
            id: 'api-unreachable',
            message: "Can't reach the server — retrying…",
            tone: 'error' as const,
            activatedAt: apiReachabilityChangedAt,
          },
        ]
      : []),
    ...(connection
      ? [
          {
            id: 'call-connection',
            message: connection.message,
            tone: connection.tone,
            activatedAt: connection.activatedAt,
          },
        ]
      : []),
  ].sort((a, b) => b.activatedAt - a.activatedAt);

  if (notices.length === 0) return null;

  return (
    <div
      className="system-notice-stack pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 sm:px-4"
      style={{ '--system-notice-tray-offset': `${trayOffset}px` } as CSSProperties}
    >
      {notices.map((notice) => (
        <SystemNoticeRow key={notice.id} notice={notice} />
      ))}
    </div>
  );
}

function SystemNoticeRow({ notice }: { notice: SystemNotice }) {
  const action = notice.fault ? recoveryActionFor(notice.fault.code) : 'none';
  const Icon = notice.tone === 'progress' ? Loader2 : notice.tone === 'error' ? WifiOff : AlertTriangle;

  return (
    <div role={notice.fault ? 'alert' : 'status'} className={`system-notice system-notice--${notice.tone} pointer-events-auto`}>
      <Icon aria-hidden="true" className={notice.tone === 'progress' ? 'system-notice__icon system-notice__icon--progress' : 'system-notice__icon'} />
      <span className="system-notice__message">{notice.message}</span>
      {action !== 'none' && <RecoveryButton action={action} />}
      {notice.fault && (
        <button type="button" aria-label="Dismiss" onClick={() => dismissFault(notice.fault!.id)} className="system-notice__dismiss">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function RecoveryButton({ action }: { action: RecoveryAction }) {
  const { label, run } = recovery(action);
  return (
    <button type="button" onClick={run} className="system-notice__action">
      {action === 'retry' && <RotateCw aria-hidden="true" />}
      {label}
    </button>
  );
}

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
