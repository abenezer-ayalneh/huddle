import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ControlBar from './ControlBar';

vi.mock('@livekit/components-react', () => ({
  useRoomContext: () => ({ getActiveDevice: vi.fn() }),
  useTrackToggle: () => ({ enabled: true, pending: false, toggle: vi.fn() }),
}));

vi.mock('./MergedControlButton', () => ({
  default: ({ label }: { label: string }) => <button type="button" aria-label={label} />,
  DeviceMenuContent: () => null,
}));

vi.mock('./DeviceRecoveryDialog', () => ({ default: () => null }));
vi.mock('./useMediaPermissions', () => ({ useMediaPermissions: () => ({ camera: 'granted', microphone: 'granted' }) }));
vi.mock('./useMuteReminder', () => ({ useMuteReminder: () => false }));
vi.mock('./useCallShortcuts', () => ({ useCallShortcuts: () => {}, useModifierKeyLabel: () => 'Ctrl+' }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderControlBar(overrides: Partial<ComponentProps<typeof ControlBar>> = {}) {
  const props = {
    onLeave: vi.fn(),
    chatOpen: false,
    onToggleChat: vi.fn(),
    iAmPresenting: false,
    someoneElsePresenting: false,
    onShareClick: vi.fn(),
    hasOutgoingRequest: false,
    ...overrides,
  };
  render(<ControlBar {...props} />);
  return props;
}

describe('ControlBar secondary controls', () => {
  it('keeps device, Chat, More, and Leave controls in the dock while moving secondary actions into More', () => {
    renderControlBar({ onPopOut: vi.fn(), recordMode: 'request', onRecordClick: vi.fn() });

    expect(screen.getByRole('button', { name: /mute microphone/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /turn camera off/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show chat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More controls' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave call' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share screen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open picture-in-picture' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request to record' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More controls' }));

    expect(screen.getByRole('button', { name: 'Share screen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open picture-in-picture' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request to record' })).toBeTruthy();
  });

  it('runs the selected More action and dismisses the popover', async () => {
    const onShareClick = vi.fn();
    renderControlBar({ onShareClick });

    fireEvent.click(screen.getByRole('button', { name: 'More controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share screen' }));

    expect(onShareClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Share screen' })).toBeNull());
  });

  it('preserves unavailable and conditional secondary actions', () => {
    renderControlBar({ remoteControlActive: true });

    fireEvent.click(screen.getByRole('button', { name: 'More controls' }));

    const present = screen.getByRole('button', { name: 'Present is unavailable during Remote Control' }) as HTMLButtonElement;
    expect(present.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /picture-in-picture/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /record/i })).toBeNull();
  });

  it('reports active secondary actions and gives recording priority to the dock indicator', () => {
    const { rerender } = render(
      <ControlBar
        onLeave={vi.fn()}
        chatOpen={false}
        onToggleChat={vi.fn()}
        iAmPresenting
        someoneElsePresenting={false}
        onShareClick={vi.fn()}
        hasOutgoingRequest={false}
        onPopOut={vi.fn()}
        pipActive
        recordMode="recording"
        onRecordClick={vi.fn()}
      />,
    );

    const recordingMore = screen.getByRole('button', { name: 'More controls. recording, presentation, picture-in-picture active.' });
    expect(recordingMore.getAttribute('aria-pressed')).toBe('true');
    expect(recordingMore.querySelector('.signal-call-more-indicator-recording')).toBeTruthy();

    rerender(
      <ControlBar
        onLeave={vi.fn()}
        chatOpen={false}
        onToggleChat={vi.fn()}
        iAmPresenting
        someoneElsePresenting={false}
        onShareClick={vi.fn()}
        hasOutgoingRequest={false}
        onPopOut={vi.fn()}
        pipActive
      />,
    );

    const activeMore = screen.getByRole('button', { name: 'More controls. presentation, picture-in-picture active.' });
    expect(activeMore.querySelector('.signal-call-more-indicator-active')).toBeTruthy();
  });
});
