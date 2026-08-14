import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PreJoinScreen from './PreJoinScreen';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createTrack(settings: MediaTrackSettings = {}) {
  return {
    getSettings: () => settings,
    stop: vi.fn(),
  };
}

function createStream({ videoTrack, audioTrack }: { videoTrack?: ReturnType<typeof createTrack>; audioTrack?: ReturnType<typeof createTrack> }) {
  const tracks = [videoTrack, audioTrack].filter(Boolean) as ReturnType<typeof createTrack>[];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => (videoTrack ? [videoTrack] : []),
    getAudioTracks: () => (audioTrack ? [audioTrack] : []),
  } as unknown as MediaStream;
}

const mediaDevices = {
  enumerateDevices: vi.fn(),
  getUserMedia: vi.fn(),
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('huddle:device-preferences', JSON.stringify({ videoEnabled: false }));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: 'Win32',
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: mediaDevices,
  });
  mediaDevices.enumerateDevices.mockResolvedValue([
    { deviceId: 'camera-1', groupId: 'group-1', kind: 'videoinput', label: 'Built-in camera', toJSON: () => ({}) },
    { deviceId: 'mic-1', groupId: 'group-1', kind: 'audioinput', label: 'Built-in microphone', toJSON: () => ({}) },
  ] satisfies MediaDeviceInfo[]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PreJoinScreen camera preview', () => {
  it('attaches each requested stream after an off preference and locks the camera controls while starting', async () => {
    const initialAudioTrack = createTrack();
    const initialStream = createStream({ audioTrack: initialAudioTrack });
    const firstCamera = deferred<MediaStream>();
    const firstVideoTrack = createTrack({ deviceId: 'camera-1' });
    const firstCameraStream = createStream({ videoTrack: firstVideoTrack });
    const secondVideoTrack = createTrack({ deviceId: 'camera-1' });
    const secondCameraStream = createStream({ videoTrack: secondVideoTrack });

    mediaDevices.getUserMedia
      .mockResolvedValueOnce(initialStream)
      .mockImplementationOnce(() => firstCamera.promise)
      .mockResolvedValueOnce(secondCameraStream);

    render(<PreJoinScreen onSubmit={vi.fn()} submitLabel="Join call" />);

    await waitFor(() => expect(screen.getByText('Camera is off')).toBeTruthy());
    const cameraSelect = screen.getByLabelText('Camera device') as HTMLSelectElement;
    await waitFor(() => expect(cameraSelect.disabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: /camera off/i }));

    expect(screen.getByText('Starting camera…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Starting camera' })).toHaveProperty('disabled', true);
    expect(cameraSelect.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Join call' }) as HTMLButtonElement).disabled).toBe(false);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { code: 'KeyE', ctrlKey: true });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);

    firstCamera.resolve(firstCameraStream);

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.srcObject).toBe(firstCameraStream);
    });

    fireEvent.click(screen.getByRole('button', { name: /camera on/i }));
    expect(firstVideoTrack.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Camera is off')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /camera off/i }));
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.srcObject).toBe(secondCameraStream);
    });
  });
});
