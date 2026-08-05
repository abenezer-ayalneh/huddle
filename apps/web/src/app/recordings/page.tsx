'use client';

import Link from 'next/link';
import { Download, ExternalLink, HardDrive, Unplug, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type GoogleDriveConnection, type MyRecording } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import IconLink from '@/components/IconLink';
import LoadingSpinner from '@/components/LoadingSpinner';

// Cross-room recordings view. Since the lobby list is pared to upcoming
// scheduled meetings, this is the only place to reach recordings of past and
// instant meetings. Session-gated; each row downloads via its own host key.
export default function RecordingsPage() {
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  const [recordings, setRecordings] = useState<MyRecording[] | null>(null);
  const [connection, setConnection] = useState<GoogleDriveConnection | null>(null);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | 'backfill' | null>(null);
  const [backfillNotice, setBackfillNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([api.listMyRecordings(), api.googleDriveConnection()])
      .then(([recordingResult, connectionResult]) => {
        if (!active) return;
        setRecordings(recordingResult.recordings);
        setConnection(connectionResult);
      })
      .catch(() => {
        if (!active) return;
        setRecordings([]);
        setConnection({ connected: false, status: 'disconnected', providerEmail: null, connectedAt: null, backfillAvailable: false });
      });
    return () => {
      active = false;
    };
  }, [session]);

  return (
    <main className="flex flex-1 items-start justify-center p-6 md:items-center">
      <div className="glass-strong w-full max-w-2xl space-y-6 rounded-2xl p-8 shadow-[0_8px_60px_oklch(0_0_0/0.5)]">
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
        ) : recordings === null || connection === null ? (
          <LoadingSpinner className="mx-auto size-10" />
        ) : (
          <>
            {searchParams.get('drive') === 'error' && (
              <p role="alert" className="rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-100">
                Google Drive could not be connected. Your Drive files were not changed. Check the local API log for the reason, then start a new connection
                attempt.
              </p>
            )}
            <section aria-labelledby="drive-heading" className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <HardDrive className="mt-0.5 size-5 text-cyan" aria-hidden="true" />
                  <div>
                    <h2 id="drive-heading" className="font-medium text-white">
                      Google Drive delivery
                    </h2>
                    <p className="mt-1 max-w-lg text-sm leading-5 text-white/55">
                      {connection.connected
                        ? `Future recordings upload privately to Huddle Recordings${connection.providerEmail ? ` in ${connection.providerEmail}` : ''}.`
                        : connection.status === 'action_required'
                          ? 'Google Drive needs reconnection before recordings can be delivered. Local copies still expire on schedule.'
                          : 'Connect a Google Drive account to upload future recordings privately and reduce VPS storage.'}
                    </p>
                  </div>
                </div>
                {connection.connected ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy('disconnect');
                      try {
                        await api.disconnectGoogleDrive();
                        setConnection({ connected: false, status: 'disconnected', providerEmail: null, connectedAt: null, backfillAvailable: false });
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                  >
                    <Unplug className="size-4" aria-hidden="true" />
                    {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy('connect');
                      try {
                        const { authorizationUrl } = await api.beginGoogleDriveConnection();
                        window.location.assign(authorizationUrl);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-medium text-black transition hover:brightness-110 disabled:opacity-50"
                  >
                    <HardDrive className="size-4" aria-hidden="true" />
                    {busy === 'connect' ? 'Opening Google…' : connection.status === 'action_required' ? 'Reconnect Drive' : 'Connect Drive'}
                  </button>
                )}
              </div>
              {connection.connected && connection.backfillAvailable && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs leading-5 text-white/50">
                    Optionally queue one delivery attempt for locally retained recordings. Historical recordings never add participant recipients.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy('backfill');
                      try {
                        const { queued } = await api.backfillGoogleDrive();
                        setBackfillNotice(queued === 1 ? 'Queued 1 retained recording.' : `Queued ${queued} retained recordings.`);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy !== null}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan/40 px-3 py-2 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
                  >
                    <UploadCloud className="size-4" aria-hidden="true" />
                    {busy === 'backfill' ? 'Queueing…' : 'Backfill retained recordings'}
                  </button>
                  {backfillNotice && (
                    <p className="mt-2 text-sm text-cyan/80" role="status">
                      {backfillNotice}
                    </p>
                  )}
                </div>
              )}
            </section>

            {recordings.length === 0 ? (
              <p className="text-sm text-white/45">No recordings yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {recordings.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-cyan/90">{r.room}</p>
                        <p className="text-xs text-white/50">
                          {new Date(r.startedAt).toLocaleString()}
                          {r.sizeBytes != null && ` · ${formatSize(r.sizeBytes)}`}
                        </p>
                        <p className="mt-1 text-xs text-white/45">{deliveryWord(r)}</p>
                        {r.localDeletedAt ? (
                          <p className="mt-1 text-xs text-amber-200/80">Local copy deleted {new Date(r.localDeletedAt).toLocaleString()}.</p>
                        ) : r.localExpiresAt ? (
                          <p className="mt-1 text-xs text-white/45">Local copy expires {new Date(r.localExpiresAt).toLocaleString()}.</p>
                        ) : null}
                        {r.recipientShares.failed > 0 && (
                          <div className="mt-1 text-xs text-amber-200/80">
                            <p>
                              {r.recipientShares.failed} recipient share {r.recipientShares.failed === 1 ? 'needs' : 'need'} attention.
                            </p>
                            <ul className="mt-1 list-disc pl-4 text-amber-100/65">
                              {r.recipientShares.failures.map((failure, index) => (
                                <li key={`${r.id}-${index}`}>{failure}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {r.driveUrl && (
                          <IconLink
                            icon={ExternalLink}
                            label={`Open ${r.filename} in Google Drive`}
                            className="border border-cyan/40 text-cyan hover:bg-cyan/10"
                            href={r.driveUrl}
                            target="_blank"
                            rel="noopener"
                          />
                        )}
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
                        ) : !r.driveUrl ? (
                          <span className="shrink-0 text-xs text-white/40">{statusWord(r.status)}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function deliveryWord(recording: MyRecording): string {
  switch (recording.deliveryStatus) {
    case 'delivered':
      return `Delivered to Google Drive${recording.deliveredAt ? ` ${new Date(recording.deliveredAt).toLocaleString()}` : ''}.`;
    case 'action_required':
      return 'Google Drive needs reconnection or attention before local expiry.';
    case 'queued':
      return 'Queued for Google Drive upload.';
    case 'uploading':
      return 'Uploading to Google Drive.';
    case 'expired_undelivered':
      return 'Local copy expired before Drive delivery completed.';
    default:
      return recording.status === 'completed' ? 'Stored locally until its expiry.' : statusWord(recording.status);
  }
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
