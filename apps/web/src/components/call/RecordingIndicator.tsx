'use client';

import { useEffect, useState } from 'react';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// The room-wide Recording Indicator (docs/adr/0011): shown to every participant
// whenever a recording is active, regardless of who started it. Its source of
// truth is the room metadata `recording` flag (see useRecording), so it appears
// and clears for everyone at once. Purpose is consent. `startedAt` (also from
// the metadata) drives the live duration timer.
export default function RecordingIndicator({ active, startedAt }: { active: boolean; startedAt: number | null }) {
  // Seed `now` lazily at mount so the first paint reflects the real elapsed time
  // (e.g. for someone who joined mid-recording); the interval keeps it ticking.
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active || startedAt == null) return;
    const initialUpdate = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialUpdate);
      clearInterval(id);
    };
  }, [active, startedAt]);

  if (!active) return null;
  return (
    <div className="signal-call-recording-indicator pointer-events-none flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-red-500/40 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      Recording
      {startedAt != null && <span className="tabular-nums text-red-300/80">{formatElapsed(now - startedAt)}</span>}
    </div>
  );
}
