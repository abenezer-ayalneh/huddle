'use client';

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// iOS Safari (iPhone) has no standard Picture-in-Picture API — it exposes the
// non-standard webkitSetPresentationMode instead. Since iOS is an explicit
// target, we feature-detect and use whichever exists.
type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

const PIP = 'picture-in-picture';

const standardSupported =
  typeof document !== 'undefined' &&
  document.pictureInPictureEnabled &&
  typeof HTMLVideoElement !== 'undefined' &&
  'requestPictureInPicture' in HTMLVideoElement.prototype;

const webkitSupported = typeof HTMLVideoElement !== 'undefined' && 'webkitSupportsPresentationMode' in HTMLVideoElement.prototype;

// Native Picture-in-Picture (CONTEXT.md "Picture-in-Picture"): the OS-level
// floating window that shows a single feed so a Background Call stays visible in
// another app. It is a bare browser PiP window, not a custom player — it holds
// exactly the one feed we attach here. The caller selects that feed (the main
// stage: presentation → Pin → Active Speaker) and passes it as `trackRef`.
export function usePictureInPicture(trackRef: TrackReferenceOrPlaceholder | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  const supported = standardSupported || webkitSupported;

  // Attach the chosen stage track to our dedicated PiP <video>. We attach the
  // LiveKit track manually (rather than rendering <VideoTrack>) so we own the
  // exact element PiP needs. A second sink on a track already rendered in the
  // grid is fine.
  const track = trackRef && isTrackReference(trackRef) ? trackRef.publication.track : undefined;
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  useEffect(() => {
    const el = videoRef.current as WebkitVideo | null;
    if (!el) return;
    const onEnter = () => setActive(true);
    const onLeave = () => setActive(false);
    const onWebkit = () => setActive(el.webkitPresentationMode === PIP);
    el.addEventListener('enterpictureinpicture', onEnter);
    el.addEventListener('leavepictureinpicture', onLeave);
    el.addEventListener('webkitpresentationmodechanged', onWebkit);
    return () => {
      el.removeEventListener('enterpictureinpicture', onEnter);
      el.removeEventListener('leavepictureinpicture', onLeave);
      el.removeEventListener('webkitpresentationmodechanged', onWebkit);
    };
  }, []);

  const enter = useCallback(async () => {
    const el = videoRef.current as WebkitVideo | null;
    if (!el) return;
    try {
      // autoPlay can race the request; nudge play so the element has data.
      if (el.readyState < 1) await el.play().catch(() => {});
      if (standardSupported && 'requestPictureInPicture' in el) {
        if (document.pictureInPictureElement === el) return;
        await el.requestPictureInPicture();
      } else if (typeof el.webkitSetPresentationMode === 'function' && el.webkitSupportsPresentationMode?.(PIP)) {
        if (el.webkitPresentationMode === PIP) return;
        el.webkitSetPresentationMode(PIP);
      }
    } catch {
      // Blocked (no user gesture on auto-enter, no video, or unsupported) —
      // PiP is best-effort, so we swallow this rather than surface a Fault.
    }
  }, []);

  const exit = useCallback(async () => {
    const el = videoRef.current as WebkitVideo | null;
    try {
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (el && typeof el.webkitSetPresentationMode === 'function' && el.webkitPresentationMode === PIP) {
        el.webkitSetPresentationMode('inline');
      }
    } catch {
      // Already gone.
    }
  }, []);

  return { videoRef, enter, exit, active, supported };
}
