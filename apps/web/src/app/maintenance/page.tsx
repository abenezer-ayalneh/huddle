'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MaintenanceShell from '@/components/maintenance/MaintenanceShell';
import styles from '@/components/maintenance/maintenance.module.css';
import { maintenanceRequest, type MaintenanceStatus } from '@/lib/maintenance';

export default function MaintenancePage() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  useEffect(() => {
    const refresh = () =>
      maintenanceRequest<MaintenanceStatus>('status')
        .then(setStatus)
        .catch(() => undefined);
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <MaintenanceShell>
      <span className={styles.status}>{status?.phase === 'off' ? 'Huddle is available' : 'Maintenance'}</span>
      <h1>{status?.phase === 'off' ? 'Ready when you are.' : 'A short pause. Then back together.'}</h1>
      <p>
        {status?.phase === 'off'
          ? 'You can return to Huddle and start or join a meeting.'
          : status?.message || 'Huddle is temporarily unavailable while we make improvements. Please check back shortly.'}
      </p>
      {status?.phase === 'scheduled' && <p>Existing meetings are wrapping up. New meetings and joins are paused.</p>}
      <div className={styles.actions}>
        <button type="button" onClick={() => window.location.assign('/')} className={styles.button}>
          {status?.phase === 'off' ? 'Return to Huddle' : 'Check again'}
        </button>
        <Link href="/admin/maintenance">Owner sign-in</Link>
      </div>
    </MaintenanceShell>
  );
}
