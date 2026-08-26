'use client';

import Link from 'next/link';
import { Download, ExternalLink, HardDrive, Unplug, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, type GoogleDriveConnection, type MyRecording } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import IconLink from '@/components/IconLink';
import { RecordingsLoadingState, RecordingsPageShell } from './RecordingsPageShell';

/*
 * SIGNAL HANDOFF RECORDING ARCHIVE
 * THESIS: A Host should read retention and delivery without searching a generic dashboard.
 * OWN-WORLD: Warm paper field, plum structural shadows, yellow attention, and a compact ledger.
 * STORY: Confirm private access, manage Drive delivery, then open a recording from its room history.
 * FIRST VIEWPORT: Huddle holds the left edge; lobby and theme controls hold the right; delivery sits beside the archive.
 * FORM: Signal Handoff operate surface, using the delivery-sidecar and chronological-ledger composition.
 */

// Cross-room recordings view. Since the lobby list is pared to upcoming
// scheduled meetings, this is the only place to reach recordings of past and
// instant meetings. Session-gated; each row downloads via its own host key.
export default function RecordingsPage() {
  return (
    <RecordingsPageShell>
      <Suspense fallback={<RecordingsLoadingState />}>
        <RecordingsContent />
      </Suspense>
    </RecordingsPageShell>
  );
}

function RecordingsContent() {
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

  if (isPending) return <RecordingsLoadingState label="Checking host access" />;

  if (!session) {
    return (
      <section className="recordings-content">
        <RecordingsMasthead />
        <div className="recordings-access-state">
          <p className="recordings-access-state__label">HOST ACCESS REQUIRED</p>
          <h2>Sign in to open this archive.</h2>
          <p>Recordings remain private to the Host account that created the room.</p>
          <Link href="/lobby" className="recordings-secondary-action">
            Return to lobby
          </Link>
        </div>
      </section>
    );
  }

  if (recordings === null || connection === null) return <RecordingsLoadingState />;

  return (
    <section className="recordings-content">
      <RecordingsMasthead />

      {searchParams.get('drive') === 'error' && (
        <p role="alert" className="recordings-alert">
          Google Drive could not be connected. Your Drive files were not changed. Check the local API log for the reason, then start a new connection attempt.
        </p>
      )}

      <div className="recordings-workspace">
        <section aria-labelledby="drive-heading" className="recordings-delivery-panel" data-state={connection.connected ? 'connected' : connection.status}>
          <div className="recordings-delivery-panel__heading">
            <HardDrive className="size-5" aria-hidden="true" />
            <div>
              <p className="recordings-panel-kicker">DELIVERY DESTINATION</p>
              <h2 id="drive-heading">Google Drive</h2>
            </div>
          </div>

          <div className="recordings-delivery-panel__status">
            <span className="recordings-delivery-panel__status-dot" />
            <span>{connection.connected ? 'Connected' : connection.status === 'action_required' ? 'Reconnect required' : 'Not connected'}</span>
          </div>

          <p className="recordings-delivery-panel__copy">
            {connection.connected
              ? `Future recordings upload privately to Huddle Recordings${connection.providerEmail ? ` in ${connection.providerEmail}` : ''}.`
              : connection.status === 'action_required'
                ? 'Google Drive needs reconnection before recordings can be delivered. Local copies still expire on schedule.'
                : 'Connect a Google Drive account to upload future recordings privately and reduce VPS storage.'}
          </p>

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
              className="recordings-secondary-action"
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
              className="recordings-primary-action"
            >
              <HardDrive className="size-4" aria-hidden="true" />
              {busy === 'connect' ? 'Opening Google…' : connection.status === 'action_required' ? 'Reconnect Drive' : 'Connect Drive'}
            </button>
          )}

          {connection.connected && connection.backfillAvailable && (
            <div className="recordings-backfill">
              <p>Optionally queue one delivery attempt for locally retained recordings. Historical recordings never add participant recipients.</p>
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
                className="recordings-text-action"
              >
                <UploadCloud className="size-4" aria-hidden="true" />
                {busy === 'backfill' ? 'Queueing…' : 'Backfill retained recordings'}
              </button>
              {backfillNotice && (
                <p className="recordings-backfill__notice" role="status">
                  {backfillNotice}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="recordings-archive" aria-labelledby="recordings-heading">
          <header className="recordings-archive__heading">
            <div>
              <p className="recordings-panel-kicker">YOUR HOSTED ROOMS</p>
              <h2 id="recordings-heading">Recording archive</h2>
            </div>
            <p>{recordings.length === 1 ? '1 recording' : `${recordings.length} recordings`}</p>
          </header>

          {recordings.length === 0 ? (
            <div className="recordings-empty-state">
              <p className="recordings-empty-state__label">NO CAPTURED SESSIONS</p>
              <h3>No recordings yet.</h3>
              <p>When a hosted room is recorded, its session will appear here with its storage and delivery status.</p>
            </div>
          ) : (
            <ul className="recordings-archive__list">
              {recordings.map((recording) => (
                <li key={recording.id} className="recordings-record">
                  <article>
                    <div className="recordings-record__identity">
                      <p className="recordings-record__room">{recording.room}</p>
                      <h3>{recording.filename}</h3>
                      <p className="recordings-record__metadata">
                        {new Date(recording.startedAt).toLocaleString()}
                        {recording.sizeBytes != null && ` · ${formatSize(recording.sizeBytes)}`}
                      </p>
                    </div>

                    <div className="recordings-record__delivery" data-tone={deliveryTone(recording)}>
                      <p>{deliveryWord(recording)}</p>
                      {recording.localDeletedAt ? (
                        <p className="recordings-record__retention" data-state="deleted">
                          Local copy deleted {new Date(recording.localDeletedAt).toLocaleString()}.
                        </p>
                      ) : recording.localExpiresAt ? (
                        <p className="recordings-record__retention">Local copy expires {new Date(recording.localExpiresAt).toLocaleString()}.</p>
                      ) : null}
                      {recording.recipientShares.failed > 0 && (
                        <div className="recordings-recipient-warning">
                          <p>
                            {recording.recipientShares.failed} recipient share {recording.recipientShares.failed === 1 ? 'needs' : 'need'} attention.
                          </p>
                          <ul>
                            {recording.recipientShares.failures.map((failure, index) => (
                              <li key={`${recording.id}-${index}`}>{failure}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="recordings-record__actions">
                      {recording.driveUrl && (
                        <IconLink
                          icon={ExternalLink}
                          label={`Open ${recording.filename} in Google Drive`}
                          className="recordings-icon-action recordings-icon-action--drive"
                          href={recording.driveUrl}
                          target="_blank"
                          rel="noopener"
                        />
                      )}
                      {recording.downloadUrl ? (
                        <IconLink
                          icon={Download}
                          label={`Download recording from ${recording.room}`}
                          className="recordings-icon-action recordings-icon-action--download"
                          href={recording.downloadUrl}
                          download={recording.filename}
                          target="_blank"
                          rel="noopener"
                        />
                      ) : !recording.driveUrl ? (
                        <span className="recordings-record__unavailable">{statusWord(recording.status)}</span>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function RecordingsMasthead() {
  return (
    <header className="recordings-masthead">
      <div>
        <p className="recordings-kicker">HOST RECORDING ARCHIVE</p>
        <h1>Recordings, kept within reach.</h1>
        <p className="recordings-intro">A private record of the rooms you hosted, with local retention and Drive delivery kept in the same clear view.</p>
      </div>
      <div className="recordings-state-rail">
        <span className="recordings-state-rail__dot" />
        <p>Private archive</p>
        <span>Host access only</span>
      </div>
    </header>
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

function deliveryTone(recording: MyRecording): 'settled' | 'pending' | 'attention' | 'critical' | 'quiet' {
  switch (recording.deliveryStatus) {
    case 'delivered':
      return 'settled';
    case 'queued':
    case 'uploading':
      return 'pending';
    case 'action_required':
      return 'attention';
    case 'expired_undelivered':
      return 'critical';
    default:
      return 'quiet';
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
