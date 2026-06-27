// Device Preference (see CONTEXT.md): the remembered settings on this browser:
// which camera, microphone, and speaker were last used, plus whether the
// microphone and camera should start on or off at the next Device Check.
// Written at Device Check submission time (when joining). A remembered device
// that is absent (unplugged) silently falls back to the browser default.

export type PreferenceKind = 'videoinput' | 'audioinput' | 'audiooutput';

export type DevicePreferences = Partial<Record<PreferenceKind, string>> & {
  audioEnabled?: boolean;
  videoEnabled?: boolean;
};

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

export function saveDevicePreferences(prefs: Partial<DevicePreferences>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadDevicePreferences(), ...prefs }));
  } catch {
    /* storage unavailable (private mode, quota) — the pick just isn't remembered */
  }
}
