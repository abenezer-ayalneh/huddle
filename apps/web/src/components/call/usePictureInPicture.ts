'use client';

import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PIP_AUTO_PREFERENCE,
  isEligiblePresentationSurface,
  parsePipAutoPreference,
  pipPreferenceAllows,
  preferredPipKind,
  PIP_AUTO_STORAGE_KEY,
  type PipAutoPreference,
  type PipKind,
  type PipOpenReason,
  type PresentationDisplaySurface,
} from './pictureInPicture.types';

type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

type MediaSessionWithDocumentPip = MediaSession & {
  setActionHandler(action: string, handler: ((details?: unknown) => void) | null): void;
};

type PictureInPictureActionDetails = {
  enterPictureInPictureReason?: 'contentoccluded' | 'useraction' | 'other';
  reason?: 'contentoccluded' | 'useraction' | 'other';
};

const PIP = 'picture-in-picture';
const PIP_WIDTH = 360;
const PIP_HEIGHT = 520;

function hasStandardVideoPip(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.pictureInPictureEnabled &&
    typeof HTMLVideoElement !== 'undefined' &&
    'requestPictureInPicture' in HTMLVideoElement.prototype
  );
}

function hasWebkitPip(): boolean {
  return typeof HTMLVideoElement !== 'undefined' && 'webkitSupportsPresentationMode' in HTMLVideoElement.prototype;
}

function copyOpenerDocument(source: Document, target: Document): HTMLElement {
  target.documentElement.className = source.documentElement.className;
  target.documentElement.lang = source.documentElement.lang;
  target.documentElement.dir = source.documentElement.dir;
  target.documentElement.dataset.theme = source.documentElement.dataset.theme ?? 'light';
  target.body.className = source.body.className;
  target.body.style.margin = '0';
  target.body.style.minWidth = '0';
  target.body.style.overflow = 'hidden';

  source.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });

  const root = target.createElement('div');
  root.id = 'huddle-picture-in-picture-root';
  root.className = 'signal-call-shell signal-call-pip-shell';
  target.body.appendChild(root);
  return root;
}

function closeDocumentPip(pipWindow: Window | null) {
  try {
    pipWindow?.close();
  } catch {
    // The browser may already have closed the document window.
  }
}

export function usePictureInPicture(
  trackRef: TrackReferenceOrPlaceholder | null,
  options: {
    presentationSurface?: PresentationDisplaySurface | null;
    presenting?: boolean;
  } = {},
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const openingRef = useRef(false);
  const openReasonRef = useRef<PipOpenReason | null>(null);
  const [active, setActive] = useState(false);
  const [kind, setKind] = useState<PipKind | null>(null);
  const [openReason, setOpenReason] = useState<PipOpenReason | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState({ document: false, video: false, webkit: false });
  useEffect(() => {
    // Capability detection is client-only and must happen after the server
    // render so the More menu hydrates without browser-specific markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCapabilities({
      document: typeof window !== 'undefined' && typeof window.documentPictureInPicture?.requestWindow === 'function',
      video: hasStandardVideoPip(),
      webkit: hasWebkitPip(),
    });
  }, []);
  const [autoPreference, setAutoPreferenceState] = useState<PipAutoPreference>(() => {
    try {
      return parsePipAutoPreference(window.localStorage.getItem(PIP_AUTO_STORAGE_KEY));
    } catch {
      return DEFAULT_PIP_AUTO_PREFERENCE;
    }
  });

  const setAutoPreference = useCallback((preference: PipAutoPreference) => {
    setAutoPreferenceState(preference);
    try {
      window.localStorage.setItem(PIP_AUTO_STORAGE_KEY, preference);
    } catch {
      // The preference still applies for this call when storage is unavailable.
    }
  }, []);

  const cleanupDocument = useCallback((expectedWindow?: Window) => {
    if (expectedWindow && pipWindowRef.current !== expectedWindow) return;
    pipWindowRef.current = null;
    portalRootRef.current = null;
    openReasonRef.current = null;
    setPortalRoot(null);
    setOpenReason(null);
    setKind(null);
    setActive(false);
  }, []);

  const openNative = useCallback(
    async (reason: PipOpenReason): Promise<boolean> => {
      const el = videoRef.current as WebkitVideo | null;
      if (!el) return false;
      try {
        if (el.readyState < 1) await el.play().catch(() => {});
        if (capabilities.video && 'requestPictureInPicture' in el) {
          if (document.pictureInPictureElement !== el) await el.requestPictureInPicture();
          setKind('video');
          setOpenReason(reason);
          openReasonRef.current = reason;
          setActive(true);
          return true;
        }
        if (capabilities.webkit && typeof el.webkitSetPresentationMode === 'function' && el.webkitSupportsPresentationMode?.(PIP)) {
          if (el.webkitPresentationMode !== PIP) el.webkitSetPresentationMode(PIP);
          setKind('video');
          setOpenReason(reason);
          openReasonRef.current = reason;
          setActive(true);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [capabilities.video, capabilities.webkit],
  );

  const enter = useCallback(
    async (reason: PipOpenReason = 'manual') => {
      if (openingRef.current || active) return;
      if (reason !== 'manual' && !pipPreferenceAllows(autoPreference, reason)) return;
      openingRef.current = true;
      setFailure(null);

      try {
        if (capabilities.document && typeof window !== 'undefined') {
          try {
            const api = window.documentPictureInPicture;
            if (!api) throw new Error('Document PiP is unavailable');
            const existing = api.window;
            const nextWindow = existing ?? (await api.requestWindow({ width: PIP_WIDTH, height: PIP_HEIGHT }));
            const root = existing
              ? (portalRootRef.current ?? copyOpenerDocument(document, nextWindow.document))
              : copyOpenerDocument(document, nextWindow.document);
            pipWindowRef.current = nextWindow;
            portalRootRef.current = root;
            nextWindow.addEventListener('pagehide', () => cleanupDocument(nextWindow), { once: true });
            setPortalRoot(root);
            setKind('document');
            setOpenReason(reason);
            openReasonRef.current = reason;
            setActive(true);
            return;
          } catch {
            // A transient-activation or browser-policy failure can still use
            // native video PiP when a playable stage feed exists.
          }
        }

        if (!(await openNative(reason))) {
          setFailure(
            reason === 'manual'
              ? 'Picture-in-picture could not be opened in this browser.'
              : 'Automatic picture-in-picture was blocked. Use the browser site controls or open it from More.',
          );
        }
      } finally {
        openingRef.current = false;
      }
    },
    [active, autoPreference, capabilities.document, cleanupDocument, openNative],
  );

  const exit = useCallback(async () => {
    if (kind === 'document') {
      closeDocumentPip(pipWindowRef.current);
      cleanupDocument();
      return;
    }
    const el = videoRef.current as WebkitVideo | null;
    try {
      if (typeof document !== 'undefined' && document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (el && typeof el.webkitSetPresentationMode === 'function' && el.webkitPresentationMode === PIP) el.webkitSetPresentationMode('inline');
    } catch {
      // Already gone.
    } finally {
      setActive(false);
      setKind(null);
      setOpenReason(null);
      openReasonRef.current = null;
    }
  }, [cleanupDocument, kind]);

  useEffect(() => {
    const el = videoRef.current as WebkitVideo | null;
    if (!el) return;
    const onEnter = () => {
      setActive(true);
      setKind('video');
      setOpenReason(openReasonRef.current ?? 'manual');
    };
    const onLeave = () => {
      setActive(false);
      setKind(null);
      setOpenReason(null);
      openReasonRef.current = null;
    };
    const onWebkit = () => (el.webkitPresentationMode === PIP ? onEnter() : onLeave());
    el.addEventListener('enterpictureinpicture', onEnter);
    el.addEventListener('leavepictureinpicture', onLeave);
    el.addEventListener('webkitpresentationmodechanged', onWebkit);
    return () => {
      el.removeEventListener('enterpictureinpicture', onEnter);
      el.removeEventListener('leavepictureinpicture', onLeave);
      el.removeEventListener('webkitpresentationmodechanged', onWebkit);
    };
  }, []);

  useEffect(() => {
    if (!active || !pipWindowRef.current) return;
    const pipWindow = pipWindowRef.current;
    const syncTheme = () => {
      pipWindow.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? 'light';
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    const mediaSession = typeof navigator !== 'undefined' ? (navigator.mediaSession as MediaSessionWithDocumentPip | undefined) : undefined;
    if (!mediaSession || !capabilities.document || !pipPreferenceAllows(autoPreference, 'tab-switch')) return;
    const onEnterPictureInPicture = (details?: unknown) => {
      const action = (details ?? {}) as PictureInPictureActionDetails;
      const reason = action.enterPictureInPictureReason ?? action.reason;
      if (reason === 'useraction') {
        void enter('manual');
        return;
      }
      // Chrome may deliver the content-occluded callback before the page's
      // visibilitychange event. The callback itself is the browser's tab-switch
      // authorization, so do not gate it on the timing of visibilityState.
      if (!reason || reason === 'contentoccluded' || document.visibilityState === 'hidden') void enter('tab-switch');
    };
    try {
      mediaSession.setActionHandler('enterpictureinpicture', onEnterPictureInPicture);
    } catch {
      // Older Chromium builds expose MediaSession without this action.
    }
    return () => {
      try {
        mediaSession.setActionHandler('enterpictureinpicture', null);
      } catch {
        // Handler cleanup is best-effort across browser versions.
      }
    };
  }, [autoPreference, capabilities.document, enter]);

  useEffect(() => {
    if (!options.presenting || !isEligiblePresentationSurface(options.presentationSurface) || active || !pipPreferenceAllows(autoPreference, 'presentation'))
      return;
    // Automatic entry is an intentional external-system side effect. The
    // browser may reject it without a transient activation, which enter()
    // converts into recoverable state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void enter('presentation');
  }, [active, autoPreference, enter, options.presenting, options.presentationSurface]);

  useEffect(() => {
    if (!active) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && openReasonRef.current !== 'manual') void exit();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [active, exit]);

  useEffect(() => {
    return () => {
      closeDocumentPip(pipWindowRef.current);
      if (typeof document !== 'undefined' && document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
    };
  }, []);

  const track = trackRef && isTrackReference(trackRef) ? trackRef.publication.track : undefined;
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return {
    videoRef,
    enter,
    exit,
    setAutoPreference,
    autoPreference,
    kind,
    active,
    openReason,
    portalRoot,
    failure,
    supported: preferredPipKind(capabilities) !== null,
    richSupported: capabilities.document,
  };
}
