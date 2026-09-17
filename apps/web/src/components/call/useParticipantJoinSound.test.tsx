import { act, cleanup, render } from '@testing-library/react';
import { RoomEvent } from 'livekit-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantJoinSound } from './useParticipantJoinSound';

const { roomMock, useRoomContextMock, audioContextMock, contextMock, oscillatorMock, gainMock } = vi.hoisted(() => {
  const oscillator = {
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const context = {
    currentTime: 10,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return {
    roomMock: { on: vi.fn(), off: vi.fn() },
    useRoomContextMock: vi.fn(),
    audioContextMock: vi.fn(() => context),
    contextMock: context,
    oscillatorMock: oscillator,
    gainMock: gain,
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
  audioContextMock.mockImplementation(function () {
    return contextMock;
  });
  vi.stubGlobal('AudioContext', audioContextMock);
  oscillatorMock.connect.mockReturnValue(gainMock);
  gainMock.connect.mockReturnValue(contextMock.destination);
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

    expect(audioContextMock).toHaveBeenCalledTimes(1);
    expect(oscillatorMock.start).toHaveBeenCalledTimes(1);
    expect(oscillatorMock.stop).toHaveBeenCalledWith(10.2);

    unmount();
    expect(roomMock.off).toHaveBeenCalledWith(RoomEvent.ParticipantConnected, handler);
  });

  it('plays one cue for an admitted participant when their call connects', async () => {
    const { rerender } = render(<HookHarness announceLocalJoin />);

    await act(async () => {
      await Promise.resolve();
    });
    rerender(<HookHarness announceLocalJoin />);

    expect(audioContextMock).toHaveBeenCalledTimes(1);
  });

  it('does not announce a Control Agent connection', async () => {
    render(<HookHarness />);
    const handler = roomMock.on.mock.calls.find(([event]) => event === RoomEvent.ParticipantConnected)?.[1];

    await act(async () => {
      handler({ identity: 'control-agent:session-1', metadata: '' });
      handler({ identity: 'agent-session-2', metadata: JSON.stringify({ role: 'control-agent' }) });
    });

    expect(audioContextMock).not.toHaveBeenCalled();
  });
});
