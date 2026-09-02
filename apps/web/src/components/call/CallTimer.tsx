'use client';

import { useRoomInfo } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/duration';
import CallThemeToggle from './CallThemeToggle';

export default function CallTimer({ hidden = false, showThemeToggle = true }: { hidden?: boolean; showThemeToggle?: boolean }) {
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

  const duration = startedAt == null ? null : formatDuration(now - startedAt);

  if (hidden || (!duration && !showThemeToggle)) return null;

  return (
    <>
      {duration ? (
        <div className="signal-call-top-rail pointer-events-none absolute left-3 top-3 z-20">
          <span role="timer" aria-label={`Call duration ${duration}`} className="signal-call-timer pointer-events-auto">
            {duration}
          </span>
        </div>
      ) : null}
      {showThemeToggle ? (
        <div className="signal-call-top-rail pointer-events-none absolute right-3 top-3 z-20">
          <CallThemeToggle />
        </div>
      ) : null}
    </>
  );
}
