import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PIP_AUTO_PREFERENCE,
  isEligiblePresentationSurface,
  parsePipAutoPreference,
  pipPreferenceAllows,
  preferredPipKind,
  type PipAutoPreference,
} from './pictureInPicture.types';
import { orderPictureInPictureTracks, selectPictureInPictureLayout } from './pictureInPictureLayout';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { usePictureInPicture } from './usePictureInPicture';

beforeEach(() => {
  window.localStorage.clear();
  delete window.documentPictureInPicture;
});

function track(identity: string, isLocal = false): TrackReferenceOrPlaceholder {
  return {
    participant: { identity, isLocal } as TrackReferenceOrPlaceholder['participant'],
    source: 'camera',
  } as unknown as TrackReferenceOrPlaceholder;
}

describe('rich picture-in-picture rules', () => {
  it('defaults invalid automatic preferences to tab switching', () => {
    expect(parsePipAutoPreference(null)).toBe(DEFAULT_PIP_AUTO_PREFERENCE);
    expect(parsePipAutoPreference('invalid')).toBe('tab-switch');
    expect(parsePipAutoPreference('always')).toBe('always');
  });

  it('persists the selected automatic preference for the next call', () => {
    const { result } = renderHook(() => usePictureInPicture(null));
    act(() => result.current.setAutoPreference('presentation'));
    expect(result.current.autoPreference).toBe('presentation');
    expect(window.localStorage.getItem('huddle-pip-auto')).toBe('presentation');
  });

  it('opens one styled Document PiP window at the requested size and reuses it', async () => {
    const pipDocument = document.implementation.createHTMLDocument('Huddle PiP');
    const addEventListener = vi.fn();
    const close = vi.fn();
    const pipWindow = { document: pipDocument, addEventListener, close } as unknown as Window;
    const requestWindow = vi.fn(async () => pipWindow);
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: { window: null, requestWindow },
    });
    document.documentElement.dataset.theme = 'dark';
    const stylesheet = document.createElement('style');
    stylesheet.textContent = '.test-style { color: red; }';
    document.head.append(stylesheet);

    const { result, unmount } = renderHook(() => usePictureInPicture(null));
    await waitFor(() => expect(result.current.richSupported).toBe(true));
    await act(async () => result.current.enter());

    expect(requestWindow).toHaveBeenCalledWith({ width: 360, height: 520 });
    expect(result.current.kind).toBe('document');
    expect(result.current.active).toBe(true);
    expect(result.current.openReason).toBe('manual');
    expect(result.current.portalRoot?.className).toContain('signal-call-pip-shell');
    expect(pipDocument.documentElement.dataset.theme).toBe('dark');
    expect([...pipDocument.head.querySelectorAll('style')].some((node) => node.textContent?.includes('.test-style'))).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function), { once: true });

    await act(async () => result.current.enter());
    expect(requestWindow).toHaveBeenCalledTimes(1);
    await act(async () => result.current.exit());
    expect(close).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('opens automatic Document PiP from the browser content-occluded action', async () => {
    const pipDocument = document.implementation.createHTMLDocument('Huddle PiP');
    const addEventListener = vi.fn();
    const close = vi.fn();
    const pipWindow = { document: pipDocument, addEventListener, close } as unknown as Window;
    const requestWindow = vi.fn(async () => pipWindow);
    const handlers = new Map<string, ((details?: unknown) => void) | null>();
    const setActionHandler = vi.fn((action: string, handler: ((details?: unknown) => void) | null) => {
      handlers.set(action, handler);
    });
    Object.defineProperty(window, 'documentPictureInPicture', {
      configurable: true,
      value: { window: null, requestWindow },
    });
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: { setActionHandler },
    });

    const { result, unmount } = renderHook(() => usePictureInPicture(null));
    await waitFor(() => expect(result.current.richSupported).toBe(true));
    await waitFor(() => expect(setActionHandler).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function)));

    await act(async () => {
      handlers.get('enterpictureinpicture')?.({ reason: 'contentoccluded' });
      await Promise.resolve();
    });

    await waitFor(() => expect(requestWindow).toHaveBeenCalledWith({ width: 360, height: 520 }));
    expect(result.current.openReason).toBe('tab-switch');
    unmount();
    Reflect.deleteProperty(navigator, 'mediaSession');
  });

  it('allows only the selected automatic trigger', () => {
    const preferences: PipAutoPreference[] = ['never', 'tab-switch', 'presentation', 'always'];
    expect(preferences.map((preference) => pipPreferenceAllows(preference, 'tab-switch'))).toEqual([false, true, false, true]);
    expect(preferences.map((preference) => pipPreferenceAllows(preference, 'presentation'))).toEqual([false, false, true, true]);
  });

  it('only treats window and monitor capture as automatic presentation triggers', () => {
    expect(isEligiblePresentationSurface('window')).toBe(true);
    expect(isEligiblePresentationSurface('monitor')).toBe(true);
    expect(isEligiblePresentationSurface('browser')).toBe(false);
    expect(isEligiblePresentationSurface(null)).toBe(false);
  });

  it('prefers Document PiP, then native video/WebKit, then unsupported', () => {
    expect(preferredPipKind({ document: true, video: true, webkit: true })).toBe('document');
    expect(preferredPipKind({ document: false, video: true, webkit: false })).toBe('video');
    expect(preferredPipKind({ document: false, video: false, webkit: true })).toBe('video');
    expect(preferredPipKind({ document: false, video: false, webkit: false })).toBeNull();
  });

  it('orders pin, active speaker, remote participants, then local and deduplicates identities', () => {
    const result = orderPictureInPictureTracks([track('local', true), track('remote-a'), track('remote-b'), track('remote-a'), track('remote-c')], {
      pinnedIdentity: 'remote-b',
      activeIdentity: 'remote-c',
      max: 4,
    });
    expect(result.tracks.map((item) => item.participant.identity)).toEqual(['remote-b', 'remote-c', 'remote-a', 'local']);
    expect(result.omittedCount).toBe(0);
  });

  it('reports omitted people after the four-tile cap', () => {
    const result = orderPictureInPictureTracks([track('local', true), track('one'), track('two'), track('three'), track('four'), track('five')], {});
    expect(result.tracks).toHaveLength(4);
    expect(result.omittedCount).toBe(2);
  });

  it('selects a participant-aware layout from the PiP window shape', () => {
    expect(selectPictureInPictureLayout(360, 520, 0)).toBe('stack');
    expect(selectPictureInPictureLayout(360, 520, 1)).toBe('single');
    expect(selectPictureInPictureLayout(360, 520, 2)).toBe('stack');
    expect(selectPictureInPictureLayout(520, 420, 2)).toBe('pair');
    expect(selectPictureInPictureLayout(520, 420, 3)).toBe('trio');
    expect(selectPictureInPictureLayout(520, 420, 4)).toBe('grid');
    expect(selectPictureInPictureLayout(520, 240, 4)).toBe('primary');
  });
});
