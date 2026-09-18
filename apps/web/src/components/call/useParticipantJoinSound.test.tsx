import { act, cleanup, render } from '@testing-library/react';
import { RoomEvent } from 'livekit-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantJoinSound } from './useParticipantJoinSound';

const { roomMock, useRoomContextMock, audioConstructorMock, audioMock } = vi.hoisted(() => {
  const audio = {
    preload: '',
    volume: 1,
    play: vi.fn(() => Promise.resolve()),
  };
  return {
    roomMock: { on: vi.fn(), off: vi.fn() },
    useRoomContextMock: vi.fn(),
    audioConstructorMock: vi.fn(() => audio),
    audioMock: audio,
  };
});

vi.mock('@livekit/components-react', () => ({
  useRoomContext: useRoomContextMock,
}));

function HookHarness({ announceLocalJoin = false }: { announceLocalJoin?: boolean }) {
  useParticipantJoinSound(announceLocalJoin);
  return null;
}

beforeEach(() => {
  useRoomContextMock.mockReturnValue(roomMock);
  audioConstructorMock.mockImplementation(function () {
    return audioMock;
  });
  vi.stubGlobal('Audio', audioConstructorMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useParticipantJoinSound', () => {
  it('plays one brief cue for each newly connected human participant', async () => {
    const { unmount } = render(<HookHarness />);
    const handler = roomMock.on.mock.calls.find(([event]) => event === RoomEvent.ParticipantConnected)?.[1];
    expect(handler).toBeTypeOf('function');

    await act(async () => {
      handler({ identity: 'guest-1', metadata: '' });
    });

    expect(audioConstructorMock).toHaveBeenCalledWith('/sounds/room-joined.mp3');
    expect(audioMock.preload).toBe('auto');
    expect(audioMock.volume).toBe(0.45);
    expect(audioMock.play).toHaveBeenCalledTimes(1);

    unmount();
    expect(roomMock.off).toHaveBeenCalledWith(RoomEvent.ParticipantConnected, handler);
  });

  it('plays one cue for the local participant when their call connects', async () => {
    const { rerender } = render(<HookHarness announceLocalJoin />);

    await act(async () => {
      await Promise.resolve();
    });
    rerender(<HookHarness announceLocalJoin />);

    expect(audioConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('does not announce a Control Agent connection', async () => {
    render(<HookHarness />);
    const handler = roomMock.on.mock.calls.find(([event]) => event === RoomEvent.ParticipantConnected)?.[1];

    await act(async () => {
      handler({ identity: 'control-agent:session-1', metadata: '' });
      handler({ identity: 'agent-session-2', metadata: JSON.stringify({ role: 'control-agent' }) });
    });

    expect(audioConstructorMock).not.toHaveBeenCalled();
  });
});
