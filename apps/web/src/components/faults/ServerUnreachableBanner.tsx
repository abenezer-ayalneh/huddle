'use client';

import { WifiOff } from 'lucide-react';
import { useApiReachable } from '@/lib/faults';

// The quiet, persistent indicator for passive/background API Reachability loss
// (docs/adr/0019). Shown when a background request (e.g. the on-focus session
// refetch, polling) can't reach the API; clears automatically when the next
// request succeeds. Never a toast — passive faults must not spam.
export default function ServerUnreachableBanner() {
  const reachable = useApiReachable();
  if (reachable) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-4 pt-3">
      <div
        role="status"
        className="glass-strong flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.16em] text-white/85 ring-1 ring-white/10"
      >
        <WifiOff className="h-3.5 w-3.5 animate-pulse text-magenta" />
        Can&apos;t reach the server — retrying…
      </div>
    </div>
  );
}
