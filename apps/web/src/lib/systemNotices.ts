// Call Connection lives inside LiveKit, while the system-notice stack is mounted
// at the app root. This tiny store is the bridge between those two trees. It
// deliberately carries presentation state only; Fault and API Reachability keep
// their established stores and semantics in lib/faults.ts.
import { useSyncExternalStore } from 'react';

export type CallConnectionNotice = {
  message: string;
  tone: 'progress' | 'error';
  activatedAt: number;
};

type CallNoticeState = {
  connection: CallConnectionNotice | null;
  trayOffset: number;
};

let state: CallNoticeState = { connection: null, trayOffset: 0 };
const listeners = new Set<() => void>();
const EMPTY_STATE: CallNoticeState = { connection: null, trayOffset: 0 };

function notify() {
  listeners.forEach((listener) => listener());
}

export function setCallConnectionNotice(next: Omit<CallConnectionNotice, 'activatedAt'> | null) {
  const sameNotice = state.connection?.message === next?.message && state.connection?.tone === next?.tone;
  if (sameNotice) return;

  state = {
    ...state,
    connection: next ? { ...next, activatedAt: Date.now() } : null,
  };
  notify();
}

export function setCallNoticeTrayOffset(next: number) {
  const trayOffset = Math.max(0, Math.round(next));
  if (state.trayOffset === trayOffset) return;
  state = { ...state, trayOffset };
  notify();
}

export function useCallNoticeState(): CallNoticeState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => state,
    () => EMPTY_STATE,
  );
}
