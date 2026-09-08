'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { maintenanceRequest, type MaintenanceStatus } from '@/lib/maintenance';

// Catches cached navigations and tabs that were already open when the owner
// enabled maintenance. A connected call owns its warning and disconnect path.
export default function MaintenanceNavigation() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith('/admin/maintenance') || path.startsWith('/verify-email') || path === '/maintenance') return;
    let cancelled = false;
    let pending = false;
    async function check() {
      if (pending || document.querySelector('[data-maintenance-call]')) return;
      pending = true;
      try {
        const status = await maintenanceRequest<MaintenanceStatus>('status');
        if (!cancelled && status.phase !== 'off' && !document.querySelector('[data-maintenance-call]')) window.location.replace('/maintenance');
      } catch {
        /* Existing reachability layer reports transport failures. */
      } finally {
        pending = false;
      }
    }
    void check();
    const timer = setInterval(() => void check(), 3000);
    window.addEventListener('huddle:maintenance', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('huddle:maintenance', check);
    };
  }, [path]);
  return null;
}
