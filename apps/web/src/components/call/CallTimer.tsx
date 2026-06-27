'use client';

import { useRoomInfo } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/duration';

export default function CallTimer() {
  const { metadata } = useRoomInfo();
  // Seed `now` lazily at mount (an allowed impure initializer) so the first
  // paint reflects the real current time; the interval keeps it ticking.
  const [now, setNow] = useState(Date.now);

  const startedAt = (() => {
    if (!metadata) return null;
    try {
      const v = (JSON.parse(metadata) as { startedAt?: unknown }).startedAt;
      return typeof v === 'number' ? v : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20">
      <span className="glass-strong pointer-events-auto rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums text-white/80 shadow-lg">
        {formatDuration(now - startedAt)}
      </span>
    </div>
  );
}
