import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalVideoTrack } from 'livekit-client';
import { usePresentation } from './usePresentation';

const { localParticipant, room, localScreenTrack } = vi.hoisted(() => ({
  localParticipant: {
    identity: 'presenter',
    name: 'Presenter',
    getTrackPublication: vi.fn(),
    createScreenTracks: vi.fn(),
    setScreenShareEnabled: vi.fn(),
  },
  room: { on: vi.fn(), off: vi.fn() },
  localScreenTrack: { participant: { identity: 'presenter', name: 'Presenter' }, source: 'screen_share' },
}));

vi.mock('@livekit/components-react', () => ({
  isTrackReference: () => false,
  useLocalParticipant: () => ({ localParticipant }),
  useParticipantInfo: ({ participant }: { participant: { name?: string; metadata?: string } }) => ({ name: participant.name, metadata: participant.metadata }),
  useRoomContext: () => room,
  useTracks: () => [localScreenTrack],
}));

vi.mock('livekit-client', () => ({
  LocalVideoTrack: class LocalVideoTrack {},
  RoomEvent: { DataReceived: 'dataReceived', ParticipantDisconnected: 'participantDisconnected' },
  Track: { Source: { ScreenShare: 'screen_share' }, Kind: { Video: 'video' } },
}));

vi.mock('@/lib/presentProtocol', () => ({ PRESENT_TOPIC: 'present', decode: vi.fn(), sendPresentMessage: vi.fn() }));
vi.mock('@/lib/controlProtocol', () => ({ isControlAgentParticipant: () => false }));

const TestVideoTrack = LocalVideoTrack as unknown as new () => {
  kind: string;
  mediaStreamTrack: { stop: () => void };
  replaceTrack: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

class PublishedVideoTrack extends TestVideoTrack {
  kind = 'video';
  replaceTrack = vi.fn().mockResolvedValue(undefined);
  stop = vi.fn();
  constructor(public mediaStreamTrack: { stop: () => void }) {
    super();
  }
}

describe('usePresentation screen replacement', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('captures first, then replaces the existing publication and disposes of the old source', async () => {
    const oldSource = { stop: vi.fn() };
    const newSource = { stop: vi.fn() };
    const unusedAudio = { kind: 'audio', stop: vi.fn() };
    const publishedTrack = new PublishedVideoTrack(oldSource);
    const capturedTrack = new PublishedVideoTrack(newSource);
    localParticipant.getTrackPublication.mockReturnValue({ track: publishedTrack });
    localParticipant.createScreenTracks.mockResolvedValue([capturedTrack, unusedAudio]);
    const { result } = renderHook(() => usePresentation(false));

    await act(async () => result.current.changeMyShare());

    expect(localParticipant.createScreenTracks).toHaveBeenCalledWith({ audio: false });
    expect(publishedTrack.replaceTrack).toHaveBeenCalledWith(newSource, true);
    expect(oldSource.stop).toHaveBeenCalledOnce();
    expect(unusedAudio.stop).toHaveBeenCalledOnce();
    expect(localParticipant.setScreenShareEnabled).not.toHaveBeenCalled();
    expect(result.current.switchingPresentation).toBe(false);
  });

  it('preserves the active publication when the capture picker is cancelled', async () => {
    const oldSource = { stop: vi.fn() };
    const publishedTrack = new PublishedVideoTrack(oldSource);
    localParticipant.getTrackPublication.mockReturnValue({ track: publishedTrack });
    localParticipant.createScreenTracks.mockRejectedValue(new Error('picker cancelled'));
    const { result } = renderHook(() => usePresentation(false));

    await act(async () => result.current.changeMyShare());

    expect(publishedTrack.replaceTrack).not.toHaveBeenCalled();
    expect(oldSource.stop).not.toHaveBeenCalled();
    expect(result.current.switchingPresentation).toBe(false);
  });

  it('stops the newly captured source if the in-place replacement fails', async () => {
    const oldSource = { stop: vi.fn() };
    const newSource = { stop: vi.fn() };
    const publishedTrack = new PublishedVideoTrack(oldSource);
    publishedTrack.replaceTrack.mockRejectedValue(new Error('publish failed'));
    const capturedTrack = new PublishedVideoTrack(newSource);
    localParticipant.getTrackPublication.mockReturnValue({ track: publishedTrack });
    localParticipant.createScreenTracks.mockResolvedValue([capturedTrack]);
    const { result } = renderHook(() => usePresentation(false));

    await act(async () => result.current.changeMyShare());

    expect(capturedTrack.stop).toHaveBeenCalledOnce();
    expect(oldSource.stop).not.toHaveBeenCalled();
    expect(result.current.switchingPresentation).toBe(false);
  });

  it('ignores repeated picker requests while one replacement is in progress', async () => {
    const oldSource = { stop: vi.fn() };
    const newSource = { stop: vi.fn() };
    const publishedTrack = new PublishedVideoTrack(oldSource);
    const capturedTrack = new PublishedVideoTrack(newSource);
    localParticipant.getTrackPublication.mockReturnValue({ track: publishedTrack });
    let finishCapture!: (tracks: PublishedVideoTrack[]) => void;
    localParticipant.createScreenTracks.mockImplementation(() => new Promise((resolve) => (finishCapture = resolve)));
    const { result } = renderHook(() => usePresentation(false));

    let firstChange!: Promise<void>;
    act(() => {
      firstChange = result.current.changeMyShare();
    });
    await act(async () => {
      await result.current.changeMyShare();
      expect(localParticipant.createScreenTracks).toHaveBeenCalledOnce();
      finishCapture([capturedTrack]);
      await firstChange;
    });

    expect(publishedTrack.replaceTrack).toHaveBeenCalledOnce();
    expect(oldSource.stop).toHaveBeenCalledOnce();
  });
});
