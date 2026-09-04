export type PipAutoPreference = 'never' | 'tab-switch' | 'presentation' | 'always';
export type PipKind = 'document' | 'video';
export type PipOpenReason = 'manual' | 'tab-switch' | 'presentation';
export type PresentationDisplaySurface = 'browser' | 'window' | 'monitor' | 'unknown';

export const PIP_AUTO_STORAGE_KEY = 'huddle-pip-auto';
export const DEFAULT_PIP_AUTO_PREFERENCE: PipAutoPreference = 'tab-switch';

export function parsePipAutoPreference(value: string | null | undefined): PipAutoPreference {
  if (value === 'never' || value === 'tab-switch' || value === 'presentation' || value === 'always') return value;
  return DEFAULT_PIP_AUTO_PREFERENCE;
}

export function pipPreferenceAllows(preference: PipAutoPreference, reason: Exclude<PipOpenReason, 'manual'>): boolean {
  return preference === 'always' || preference === reason;
}

export function isEligiblePresentationSurface(surface: PresentationDisplaySurface | null | undefined): boolean {
  return surface === 'window' || surface === 'monitor';
}

export function preferredPipKind(capabilities: { document: boolean; video: boolean; webkit: boolean }): PipKind | null {
  if (capabilities.document) return 'document';
  if (capabilities.video || capabilities.webkit) return 'video';
  return null;
}

export type DocumentPictureInPictureWindow = Window & {
  documentPictureInPicture?: DocumentPictureInPicture;
};

export type DocumentPictureInPicture = EventTarget & {
  window: Window | null;
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export {};
