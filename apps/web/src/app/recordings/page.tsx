"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type MyRecording } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

// Cross-room recordings view. Since the lobby list is pared to upcoming
// scheduled meetings, this is the only place to reach recordings of past and
// instant meetings. Session-gated; each row downloads via its own host key.
export default function RecordingsPage() {
  const { data: session, isPending } = useSession();
  const [recordings, setRecordings] = useState<MyRecording[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    api
      .listMyRecordings()
      .then((r) => active && setRecordings(r.recordings))
      .catch(() => active && setRecordings([]));
    return () => {
      active = false;
    };
  }, [session]);

  const download = useCallback(async (rec: MyRecording) => {
    try {
      const blob = await api.downloadRecording(rec.room, rec.id, rec.hostKey);
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
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-black/10 p-8 shadow-sm dark:border-white/15">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Recordings</h1>
          <Link
            href="/"
            className="text-sm text-black/60 underline-offset-2 hover:underline dark:text-white/60"
          >
            Back to lobby
          </Link>
        </header>

        {isPending ? (
          <p className="text-sm text-black/60 dark:text-white/60">Loading…</p>
        ) : !session ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            Sign in to view your recordings.
          </p>
        ) : recordings === null ? (
          <p className="text-sm text-black/60 dark:text-white/60">Loading…</p>
        ) : recordings.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No recordings yet.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {recordings.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm">{r.room}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {new Date(r.startedAt).toLocaleString()}
                    {r.sizeBytes != null && ` · ${formatSize(r.sizeBytes)}`}
                  </p>
                </div>
                {r.downloadable ? (
                  <button
                    type="button"
                    onClick={() => download(r)}
                    className="shrink-0 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
                  >
                    Download
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                    {statusWord(r.status)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}

function statusWord(status: MyRecording["status"]): string {
  switch (status) {
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
