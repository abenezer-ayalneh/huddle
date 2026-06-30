'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type MyRecording } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import IconLink from '@/components/IconLink';
import LoadingSpinner from '@/components/LoadingSpinner';

// Cross-room recordings view. Since the lobby list is pared to upcoming
// scheduled meetings, this is the only place to reach recordings of past and
// instant meetings. Session-gated; each row downloads via its own host key.
export default function RecordingsPage() {
  const { data: session, isPending } = useSession();
  const [recordings, setRecordings] = useState<MyRecording[] | null>(null);

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

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="glass-strong w-full max-w-md space-y-6 rounded-2xl p-8 shadow-[0_8px_60px_oklch(0_0_0/0.5)]">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-white">Recordings</h1>
          <Link href="/lobby" className="text-sm text-white/55 underline-offset-2 transition-colors hover:text-cyan hover:underline">
            Back to lobby
          </Link>
        </header>

        {isPending ? (
          <LoadingSpinner className="mx-auto size-10" />
        ) : !session ? (
          <p className="text-sm text-white/55">Sign in to view your recordings.</p>
        ) : recordings === null ? (
          <LoadingSpinner className="mx-auto size-10" />
        ) : recordings.length === 0 ? (
          <p className="text-sm text-white/45">No recordings yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {recordings.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-cyan/90">{r.room}</p>
                  <p className="text-xs text-white/50">
                    {new Date(r.startedAt).toLocaleString()}
                    {r.sizeBytes != null && ` · ${formatSize(r.sizeBytes)}`}
                  </p>
                </div>
                {r.downloadUrl ? (
                  <IconLink
                    icon={Download}
                    label={`Download recording from ${r.room}`}
                    className="bg-cyan text-black hover:brightness-110"
                    href={r.downloadUrl}
                    download={r.filename}
                    target="_blank"
                    rel="noopener"
                  />
                ) : (
                  <span className="shrink-0 text-xs text-white/40">{statusWord(r.status)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function statusWord(status: MyRecording['status']): string {
  switch (status) {
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
