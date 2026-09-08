'use client';
import { useEffect, useState } from 'react';
import { setMaintenanceNotice } from '@/lib/systemNotices';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { maintenanceRequest, type MaintenanceStatus } from '@/lib/maintenance';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import styles from './maintenance.module.css';

export default function MaintenanceWarning() {
  const room = useRoomContext();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [remaining, setRemaining] = useState(300);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let snapshot: MaintenanceStatus | null = null;
    let receivedAt = 0;
    let pending = false;
    let disconnecting = false;
    function metadataChanged() {
      try {
        const parsed = JSON.parse(room.metadata || '{}') as { maintenance?: MaintenanceStatus };
        if (
          parsed.maintenance &&
          (parsed.maintenance.phase === 'off' || parsed.maintenance.startsAt) &&
          Number.isFinite(Date.parse(parsed.maintenance.serverTime))
        ) {
          if (!snapshot || Date.parse(parsed.maintenance.serverTime) >= Date.parse(snapshot.serverTime)) {
            snapshot = parsed.maintenance;
            receivedAt = performance.now();
            setStatus(snapshot);
          }
        }
      } catch {
        /* Ignore unrelated malformed metadata. */
      }
    }
    room.on(RoomEvent.RoomMetadataChanged, metadataChanged);
    // A client may attach after the server already published the countdown.
    // Read the current metadata too; waiting for a later change would make a
    // participant depend on API polling to receive their warning.
    metadataChanged();
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const next = await maintenanceRequest<MaintenanceStatus>('status');
        if (!cancelled && (!snapshot || Date.parse(next.serverTime) >= Date.parse(snapshot.serverTime))) {
          snapshot = next;
          receivedAt = performance.now();
          setStatus(next);
        }
      } catch {
        /* Preserve the known deadline across an API interruption. */
      } finally {
        pending = false;
      }
    }
    function tick() {
      if (!snapshot || snapshot.phase === 'off' || !snapshot.startsAt) {
        setMaintenanceNotice(null);
        return;
      }
      const serverNow = Date.parse(snapshot.serverTime) + performance.now() - receivedAt;
      const seconds = Math.max(0, Math.ceil((Date.parse(snapshot.startsAt) - serverNow) / 1000));
      setRemaining(seconds);
      setMaintenanceNotice(`Meeting ends for maintenance in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
      if (seconds === 0 && !disconnecting) {
        disconnecting = true;
        void room.disconnect().finally(() => window.location.replace('/maintenance'));
      }
    }
    void refresh();
    const poll = setInterval(() => void refresh(), 1000);
    const clock = setInterval(tick, 250);
    window.addEventListener('focus', refresh);
    return () => {
      setMaintenanceNotice(null);
      room.off(RoomEvent.RoomMetadataChanged, metadataChanged);
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener('focus', refresh);
    };
  }, [room]);
  if (!status || status.phase === 'off') return <span hidden data-maintenance-call />;
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return (
    <>
      <span hidden data-maintenance-call />
      <div className={styles.countdown}>Maintenance · Meeting ends in {countdown}</div>
      <AlertDialog
        open={acknowledged !== status.startsAt}
        onOpenChange={(open) => {
          if (!open) setAcknowledged(status.startsAt);
        }}
      >
        <AlertDialogContent className="signal-call-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>This meeting will end for maintenance.</AlertDialogTitle>
            <AlertDialogDescription>
              Huddle is going offline shortly. Please wrap up your conversation and save anything you need. This call, recording, and remote control will end
              automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p>
            Time remaining: <strong>{countdown}</strong>
          </p>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAcknowledged(status.startsAt)}>Understood</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
