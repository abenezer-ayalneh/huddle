'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { maintenanceRequest } from '@/lib/maintenance';

export default function OwnerMaintenanceLink() {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void maintenanceRequest<{ owner: boolean }>('access')
      .then((result) => {
        if (!cancelled) setOwner(result.owner);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return owner ? (
    <Link href="/admin/maintenance" className="lobby-recordings-link">
      Manage maintenance
    </Link>
  ) : null;
}
