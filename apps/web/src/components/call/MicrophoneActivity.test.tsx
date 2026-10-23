import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MicrophoneActivity from './MicrophoneActivity';

const audio = vi.hoisted(() => ({ volume: 0, track: {}, useTrackVolume: vi.fn() }));
vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({ microphoneTrack: { track: audio.track } }),
  useTrackVolume: (track: unknown) => {
    audio.useTrackVolume(track);
    return audio.volume;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('uses the existing mic track and scales bars with volume, collapsing to dots when silent', () => {
  audio.volume = 0;
  const { rerender } = render(<MicrophoneActivity speaking />);
  const heights = () => Array.from(screen.getByRole('img').children).map((bar) => bar.getAttribute('style'));
  expect(audio.useTrackVolume).toHaveBeenCalledWith(
    expect.objectContaining({
      publication: { track: audio.track },
      source: 'microphone',
    }),
  );
  expect(heights()).toEqual(['height: 4px;', 'height: 4px;', 'height: 4px;']);
  audio.volume = 0.1;
  rerender(<MicrophoneActivity speaking />);
  expect(screen.getByRole('img').children[1].getAttribute('style')).toBe('height: 8.8px;');
  audio.volume = 1;
  rerender(<MicrophoneActivity speaking />);
  expect(screen.getByRole('img').children[1].getAttribute('style')).toBe('height: 20px;');
  rerender(<MicrophoneActivity speaking={false} />);
  expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Microphone on');
  expect(heights()).toEqual(['height: 4px;', 'height: 4px;', 'height: 4px;']);
});

it('keeps invalid volume readings at rest', () => {
  audio.volume = Number.NaN;
  render(<MicrophoneActivity speaking />);
  expect(screen.getByRole('img').children[1].getAttribute('style')).toBe('height: 4px;');
});
