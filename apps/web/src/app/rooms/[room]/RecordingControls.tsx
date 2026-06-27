'use client';

import { Circle, Download, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, type RecordingSummary } from '@/lib/api';
import IconButton from '@/components/IconButton';
import IconLink from '@/components/IconLink';

export default function RecordingControls({ room, hostKey, compact = false }: { room: string; hostKey: string; compact?: boolean }) {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = recordings.find((r) => r.status === 'starting' || r.status === 'active');

  const refresh = useCallback(async () => {
    try {
      const { recordings } = await api.listRecordings(room, hostKey);
      setRecordings(recordings);
    } catch {
      // Transient — keep the last known list and retry next tick.
    }
  }, [room, hostKey]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.startRecording(room, hostKey);
      await refresh();
    } catch {
      setError("Couldn't start recording.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.stopRecording(room, id, hostKey);
      await refresh();
    } catch {
      setError("Couldn't stop recording.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {active ? (
          <IconButton
            icon={Square}
            label="Stop recording"
            size="sm"
            className="bg-red-500 text-white hover:bg-red-400"
            disabled={busy}
            onClick={() => stop(active.id)}
          />
        ) : (
          <IconButton
            icon={Circle}
            label="Start recording"
            variant="subtle"
            size="sm"
            className="[&>svg]:fill-red-500 [&>svg]:text-red-500"
            disabled={busy}
            onClick={start}
          />
        )}
        {active && (
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {active.status === 'starting' ? 'Starting…' : 'Recording'}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {recordings.length > 0 && (
        <ul className="space-y-1.5">
          {recordings.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                <span className="text-white/80">{formatTime(r.startedAt)}</span>
                {hasStopped(r) && r.durationMs != null && <span className="ml-2 text-white/40">{formatDuration(r.durationMs)}</span>}
              </span>
              {r.downloadUrl ? (
                <IconLink
                  icon={Download}
                  label={`Download ${r.filename}`}
                  size="sm"
                  className="bg-cyan text-black hover:brightness-110"
                  href={r.downloadUrl}
                  download={r.filename}
                  // A successful download streams to the browser's shelf without
                  // navigating; _blank ensures a rare failed download (e.g. an
                  // expired token) can't replace — and tear down — the live call.
                  target="_blank"
                  rel="noopener"
                />
              ) : (
                <span className="shrink-0 text-white/40">{statusWord(r)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!compact && recordings.length === 0 && <p className="text-xs text-white/40">No recordings yet.</p>}
    </div>
  );
}

function statusWord(r: RecordingSummary): string {
  switch (r.status) {
    case 'starting':
      return 'Starting…';
    case 'active':
      return 'Recording…';
    case 'failed':
      return 'Failed';
    case 'aborted':
      return 'Aborted';
    default:
      return 'Processing…';
  }
}

// A recording has stopped once it is no longer starting/active — i.e. it ended
// (completed, failed, or aborted). The recorded length is only meaningful then.
function hasStopped(r: RecordingSummary): boolean {
  return r.status !== 'starting' && r.status !== 'active';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Recorded length as m:ss (or h:mm:ss past an hour), e.g. 2:05 or 1:02:05.
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
