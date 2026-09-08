'use client';

import { useRoomInfo } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/duration';
import CallThemeToggle from './CallThemeToggle';

export default function CallTimer({ showThemeToggle = true }: { showThemeToggle?: boolean }) {
  const { metadata } = useRoomInfo();
  // Seed `now` lazily at mount (an allowed impure initializer) so the first
  // paint reflects the real current time; the interval keeps it ticking.
  const [now, setNow] = useState(Date.now);

  const { startedAt, serverTime } = (() => {
    if (!metadata) return { startedAt: null, serverTime: null };
    try {
      const parsed = JSON.parse(metadata) as { startedAt?: unknown; serverTime?: unknown };
      return {
        startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
        serverTime: typeof parsed.serverTime === 'number' ? parsed.serverTime : null,
      };
    } catch {
      return { startedAt: null, serverTime: null };
    }
  })();

  // `startedAt` and `serverTime` are written by the API. Offset the local
  // ticking clock with that server reference so a fast host clock cannot make
  // the call appear longer for the host than for other participants.
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number | null>(() => (serverTime == null ? null : serverTime - Date.now()));

  useEffect(() => {
    // Defer the state sync until after render so metadata updates can refresh
    // the offset without triggering a cascading render from the effect body.
    const id = window.setTimeout(() => setServerClockOffsetMs(serverTime == null ? null : serverTime - Date.now()), 0);
    return () => window.clearTimeout(id);
  }, [serverTime]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const duration = startedAt == null ? null : formatDuration(now + (serverClockOffsetMs ?? 0) - startedAt);

  if (!duration && !showThemeToggle) return null;

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
