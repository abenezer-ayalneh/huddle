"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type RecordingSummary } from "@/lib/api";

// Host-only recording controls (Phase 8): start/stop the room-composite
// recording and download finished files. Authorized with the per-room hostKey.
// Reused inside the in-call HostPanel and the post-meeting dashboard.
export default function RecordingControls({
  room,
  hostKey,
  compact = false,
}: {
  room: string;
  hostKey: string;
  compact?: boolean;
}) {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = recordings.find(
    (r) => r.status === "starting" || r.status === "active"
  );

  const refresh = useCallback(async () => {
    try {
      const { recordings } = await api.listRecordings(room, hostKey);
      setRecordings(recordings);
    } catch {
      // Transient — keep the last known list and retry next tick.
    }
  }, [room, hostKey]);

  // Poll so a recording's status (starting → active → completed) and a freshly
  // finished file's download button appear without a manual refresh.
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
      setError("Couldn’t start recording.");
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
      setError("Couldn’t stop recording.");
    } finally {
      setBusy(false);
    }
  };

  const download = async (rec: RecordingSummary) => {
    try {
      const blob = await api.downloadRecording(room, rec.id, hostKey);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = rec.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn’t download that recording.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {active ? (
          <button
            onClick={() => stop(active.id)}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Stop recording
          </button>
        ) : (
          <button
            onClick={start}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-white/15 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Record
          </button>
        )}
        {active && (
          <span className="text-xs text-white/60">
            {active.status === "starting" ? "Starting…" : "Recording"}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {recordings.length > 0 && (
        <ul className="space-y-1.5">
          {recordings.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate">
                <span className="text-white/80">{formatTime(r.startedAt)}</span>
                <span className="ml-2 text-white/40">{labelFor(r)}</span>
              </span>
              {r.downloadable ? (
                <button
                  onClick={() => download(r)}
                  className="shrink-0 rounded bg-emerald-500 px-2 py-1 font-medium text-black"
                >
                  Download
                </button>
              ) : (
                <span className="shrink-0 text-white/40">{statusWord(r)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!compact && recordings.length === 0 && (
        <p className="text-xs text-white/40">No recordings yet.</p>
      )}
    </div>
  );
}

function statusWord(r: RecordingSummary): string {
  switch (r.status) {
    case "starting":
      return "Starting…";
    case "active":
      return "Recording…";
    case "failed":
      return "Failed";
    case "aborted":
      return "Aborted";
    default:
      return "Processing…";
  }
}

function labelFor(r: RecordingSummary): string {
  if (r.downloadable && r.sizeBytes != null) return formatSize(r.sizeBytes);
  return statusWord(r);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
