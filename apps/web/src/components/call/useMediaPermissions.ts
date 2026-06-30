'use client';

import { useEffect, useRef, useState } from 'react';
import type { RecoveryDevice } from '@/lib/deviceRecovery';

// Device Recovery (docs/adr/0023). Tracks the live browser permission state of
// the camera and microphone, independently, via the Permissions API — the same
// API useMuteReminder already relies on. When a permission flips to "granted"
// (the user unblocked it from the address bar), `onGranted` fires so the surface
// can auto-acquire and turn the device back on.
//
// Per-device graceful degradation: browsers that don't expose camera/microphone
// to permissions.query (Safari, and Firefox for these names) leave that device
// at 'unsupported', and recovery there falls back to a manual retry + reload.

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type MediaPermissions = Record<RecoveryDevice, PermissionState>;

const PERMISSION_NAME: Record<RecoveryDevice, string> = {
  camera: 'camera',
  microphone: 'microphone',
};

export function useMediaPermissions(onGranted?: (device: RecoveryDevice) => void): MediaPermissions {
  const [permissions, setPermissions] = useState<MediaPermissions>({
    camera: 'unsupported',
    microphone: 'unsupported',
  });

  // Keep the latest callback without re-subscribing the listeners each render.
  const grantedRef = useRef(onGranted);
  useEffect(() => {
    grantedRef.current = onGranted;
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (['camera', 'microphone'] as RecoveryDevice[]).forEach((device) => {
      navigator.permissions
        .query({ name: PERMISSION_NAME[device] as PermissionName })
        .then((status) => {
          if (cancelled) {
            return;
          }
          setPermissions((prev) => ({ ...prev, [device]: status.state as PermissionState }));
          // Only a *change* to granted is a recovery — the initial read is just
          // the current state and must not auto-enable anything.
          const onChange = () => {
            setPermissions((prev) => ({ ...prev, [device]: status.state as PermissionState }));
            if (status.state === 'granted') grantedRef.current?.(device);
          };
          status.addEventListener('change', onChange);
          cleanups.push(() => status.removeEventListener('change', onChange));
        })
        .catch(() => {
          /* this device isn't queryable here — stays 'unsupported' */
        });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, []);

  return permissions;
}
