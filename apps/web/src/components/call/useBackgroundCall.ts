'use client';

import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { useEffect, useRef } from 'react';

// Coarse "this is a phone/tablet" check. Background Call behaviour (camera off
// on hide, auto-PiP) is a mobile concern: on desktop, hiding a tab must NOT
// turn the camera off or pop a window out.
function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

// Background Call (CONTEXT.md): keep the call running when the app loses the
// foreground on mobile. The microphone keeps publishing (still heard) while the
// camera turns off — the OS suspends capture anyway, and others see the Avatar
// rather than a frozen frame — and the camera returns to its prior state on
// foreground. The main stage is offered as Picture-in-Picture so the user can
// keep watching.
export function useBackgroundCall({ enterPip }: { enterPip: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const wasCameraOnRef = useRef(false);

  useEffect(() => {
    if (!isMobile()) return;
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        wasCameraOnRef.current = localParticipant.isCameraEnabled;
        if (localParticipant.isCameraEnabled) void localParticipant.setCameraEnabled(false);
        // Best-effort: most browsers block programmatic PiP without a gesture,
        // so this no-ops where disallowed (the pop-out button is the reliable
        // path). On iOS, succeeding here is also what keeps media alive.
        enterPip();
      } else if (wasCameraOnRef.current) {
        wasCameraOnRef.current = false;
        void localParticipant.setCameraEnabled(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [localParticipant, enterPip]);

  // Safety-net teardown for a real page termination (tab close, refresh, OS
  // reclaim): tell LiveKit to drop us now so a rejoin never races a stale
  // connection — the back-button "ghost participant". We skip bfcache-restorable
  // hides (`persisted`) so backgrounding a mobile call doesn't disconnect it.
  useEffect(() => {
    function onPageHide(event: PageTransitionEvent) {
      if (event.persisted) return;
      void room.disconnect();
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [room]);
}
