// Device Preference (see CONTEXT.md): the remembered last-used camera,
// microphone and speaker on this browser. Written on every explicit device
// pick — in the Device Check or by switching mid-call — and read to pre-select
// devices next time. A remembered device that is absent (unplugged) silently
// falls back to the browser default at the point of use.

export type PreferenceKind = 'videoinput' | 'audioinput' | 'audiooutput';

export type DevicePreferences = Partial<Record<PreferenceKind, string>>;

const STORAGE_KEY = 'huddle:device-preferences';

export function loadDevicePreferences(): DevicePreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevicePreferences) : {};
  } catch {
    return {};
  }
}

export function saveDevicePreference(kind: PreferenceKind, deviceId: string) {
  if (typeof window === 'undefined' || !deviceId) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadDevicePreferences(), [kind]: deviceId }));
  } catch {
    /* storage unavailable (private mode, quota) — the pick just isn't remembered */
  }
}
