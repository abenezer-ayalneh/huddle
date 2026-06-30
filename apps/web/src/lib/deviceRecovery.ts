// Device Recovery (see CONTEXT.md, docs/adr/0023). Pure helpers for classifying
// why a camera or microphone couldn't be acquired and tailoring the unblock
// guidance to the browser. A blocked or unavailable device is a Domain Outcome,
// never a Fault — these helpers feed the in-place recovery UI, not the Fault
// surface.

import { MediaDeviceFailure } from 'livekit-client';

export type RecoveryDevice = 'camera' | 'microphone';

// Why getUserMedia failed, in the only granularities that change the UX:
// the user blocked it, the device is busy, none is present, or something else.
export type FailureCause = 'denied' | 'inuse' | 'notfound' | 'unknown';

// Maps a getUserMedia rejection (Device Check) or a LiveKit onDeviceError
// (in-call) to a cause. Reuses livekit-client's getFailure, which keys off
// DOMException.name, so the same classifier serves both surfaces. We add
// OverconstrainedError (a vanished exact-device constraint) as "not found".
export function classifyMediaError(error: unknown): FailureCause {
  if ((error as { name?: string } | null)?.name === 'OverconstrainedError') return 'notfound';
  switch (MediaDeviceFailure.getFailure(error)) {
    case MediaDeviceFailure.PermissionDenied:
      return 'denied';
    case MediaDeviceFailure.DeviceInUse:
      return 'inuse';
    case MediaDeviceFailure.NotFound:
      return 'notfound';
    default:
      return 'unknown';
  }
}

export type BrowserId = 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';

// Coarse browser sniff, only good enough to pick which address-bar control the
// unblock steps should point at. Order matters: Edge and Chrome UAs both contain
// "Chrome"; Chrome's UA also contains "Safari".
export function detectBrowser(): BrowserId {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\/|CriOS\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
  return 'other';
}

// The browser-tailored "how to unblock" steps shown for a denied device. Where
// the Permissions API can't observe the unblock live (Safari, Firefox for
// camera/mic), the last step tells the user to reload; otherwise recovery is
// automatic. `autoRecovers` lets the dialog pick its closing line.
export function unblockSteps(browser: BrowserId): { steps: string[]; autoRecovers: boolean } {
  switch (browser) {
    case 'chrome':
    case 'edge':
      return {
        autoRecovers: true,
        steps: [
          'Click the camera icon (or the small sliders icon) at the right end of the address bar.',
          'Choose “Allow” for Camera and Microphone.',
        ],
      };
    case 'firefox':
      return {
        autoRecovers: false,
        steps: [
          'Click the camera or microphone icon in the address bar, just left of the web address.',
          'Remove the “Blocked” permission, then choose “Allow”.',
        ],
      };
    case 'safari':
      return {
        autoRecovers: false,
        steps: [
          'In the menu bar, open Safari ▸ Settings for This Website…',
          'Set Camera and Microphone to “Allow”.',
        ],
      };
    default:
      return {
        autoRecovers: false,
        steps: [
          'Look for a camera or lock icon near your browser’s address bar and click it.',
          'Set Camera and Microphone to “Allow”.',
        ],
      };
  }
}
