import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RemoteControlToast from './RemoteControlToast';
import { useRemoteControl } from './useRemoteControl';

const { apiMock, roomMock, useLocalParticipantMock, useRoomContextMock, useRoomInfoMock } = vi.hoisted(() => ({
  apiMock: { getPendingRemoteControlRequest: vi.fn() },
  roomMock: { on: vi.fn(), off: vi.fn() },
  useLocalParticipantMock: vi.fn(),
  useRoomContextMock: vi.fn(),
  useRoomInfoMock: vi.fn(),
}));

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: useLocalParticipantMock,
  useRoomContext: useRoomContextMock,
  useRoomInfo: useRoomInfoMock,
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
  isFaultError: () => false,
}));

function PromptHarness() {
  const remoteControl = useRemoteControl({ room: 'design-review', participantToken: 'participant-token' });
  return (
    <RemoteControlToast
      incoming={remoteControl.incomingRequest}
      outgoing={remoteControl.outgoingRequest}
      notice={remoteControl.notice}
      recordingActive={false}
      onApprove={remoteControl.approve}
      onDeny={remoteControl.deny}
      onDismiss={remoteControl.dismissNotice}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-02T10:05:00.000Z'));
  apiMock.getPendingRemoteControlRequest
    .mockResolvedValueOnce({
      request: {
        requestId: 'request-id',
        room: 'design-review',
        sharerIdentity: 'sharer',
        sharerName: 'Ada',
        controllerIdentity: 'controller',
        controllerName: 'Bo',
        requestedAt: '2026-09-02T10:00:00.000Z',
        expiresAt: '2026-09-02T10:00:30.000Z',
        expiresInMs: 25_000,
      },
    })
    .mockResolvedValue({ request: null });
  useLocalParticipantMock.mockReturnValue({ localParticipant: { identity: 'sharer' } });
  useRoomContextMock.mockReturnValue(roomMock);
  useRoomInfoMock.mockReturnValue({ metadata: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useRemoteControl pending recovery', () => {
  it('renders a server-valid prompt on a browser clock five minutes ahead, then clears it after the supplied TTL', async () => {
    render(<PromptHarness />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('dialog').textContent).toContain('Bo wants to control your desktop.');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24_999);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
