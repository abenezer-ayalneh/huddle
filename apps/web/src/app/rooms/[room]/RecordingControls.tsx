"use client";

import { Circle, Download, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type RecordingSummary } from "@/lib/api";
import IconButton from "@/components/IconButton";

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
      setError("Couldn't download that recording.");
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
                <IconButton
                  icon={Download}
                  label={`Download ${r.filename}`}
                  size="sm"
                  className="bg-cyan text-black hover:brightness-110"
                  onClick={() => download(r)}
                />
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
