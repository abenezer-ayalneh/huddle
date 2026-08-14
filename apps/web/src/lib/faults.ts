// Runtime for the web's Fault strategy (docs/adr/0017, 0019):
//   - a Fault toast queue, deduped by code, that components subscribe to
//   - an API Reachability store driving the quiet "Server Unreachable" banner
//
// Framework-light on purpose: a tiny pub/sub so the shared low-level fetch
// (lib/http.ts) — which is not a React component — can push faults and flip
// reachability, while components read via useSyncExternalStore. This module must
// not import lib/http (http imports this; keep the dependency one-way).
import { useSyncExternalStore } from 'react';
import type { Fault } from './faultCodes';

// ---------------------------------------------------------------------------
// API Reachability — whether the API/auth backend answered our last attempt.
// Passive/background transport faults surface ONLY through this (a banner),
// never a toast.
// ---------------------------------------------------------------------------
let reachable = true;
let reachabilityChangedAt = 0;
const reachListeners = new Set<() => void>();

export function setReachable(next: boolean): void {
  if (reachable === next) return;
  reachable = next;
  reachabilityChangedAt = Date.now();
  reachListeners.forEach((l) => l());
}

export function useApiReachable(): boolean {
  return useSyncExternalStore(
    (cb) => {
      reachListeners.add(cb);
      return () => reachListeners.delete(cb);
    },
    () => reachable,
    () => true, // SSR snapshot: assume reachable so no banner flashes during hydration.
  );
}

export function useApiReachabilityChangedAt(): number {
  return useSyncExternalStore(
    (cb) => {
      reachListeners.add(cb);
      return () => reachListeners.delete(cb);
    },
    () => reachabilityChangedAt,
    () => 0,
  );
}

// ---------------------------------------------------------------------------
// Fault toast queue — user-initiated faults only. Dedup by code with a short
// cooldown so a down-server burst (or a polling loop) shows once, not N times.
// ---------------------------------------------------------------------------
export type ActiveFault = Fault & { id: number; activatedAt: number };

const COOLDOWN_MS = 4000;
let faults: ActiveFault[] = [];
let nextId = 1;
const lastEmittedAt = new Map<string, number>();
const faultListeners = new Set<() => void>();

function notifyFaults() {
  faultListeners.forEach((l) => l());
}

// Surface a Fault on the toast. Identical codes within the cooldown collapse
// into the existing toast rather than stacking (docs/adr/0019).
export function emitFault(fault: Fault): void {
  const now = Date.now();
  if (now - (lastEmittedAt.get(fault.code) ?? 0) < COOLDOWN_MS) return;
  lastEmittedAt.set(fault.code, now);
  faults = [...faults.filter((f) => f.code !== fault.code), { ...fault, id: nextId++, activatedAt: now }];
  notifyFaults();
}

export function dismissFault(id: number): void {
  faults = faults.filter((f) => f.id !== id);
  notifyFaults();
}

const EMPTY: ActiveFault[] = [];

export function useFaults(): ActiveFault[] {
  return useSyncExternalStore(
    (cb) => {
      faultListeners.add(cb);
      return () => faultListeners.delete(cb);
    },
    () => faults,
    () => EMPTY,
  );
}
