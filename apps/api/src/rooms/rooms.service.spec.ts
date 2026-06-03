import { ConflictException, NotFoundException } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';

describe('RoomsService', () => {
  let state: RoomStateService;
  let livekit: jest.Mocked<Pick<LivekitService, 'createRoom' | 'mintToken'>> & {
    livekitUrl: string;
  };
  let service: RoomsService;

  beforeEach(() => {
    state = new RoomStateService();
    livekit = {
      livekitUrl: 'ws://localhost:7880',
      createRoom: jest.fn().mockResolvedValue(undefined),
      mintToken: jest.fn().mockResolvedValue('jwt-token'),
    };
    service = new RoomsService(state, livekit as unknown as LivekitService);
  });

  it('creates a room and mints a host token', async () => {
    const res = await service.createRoom('standup', 'Ada');
    expect(livekit.createRoom).toHaveBeenCalledWith('standup');
    expect(livekit.mintToken).toHaveBeenCalledWith(
      expect.objectContaining({ room: 'standup', host: true }),
    );
    expect(res.token).toBe('jwt-token');
    expect(res.hostKey).toEqual(expect.any(String));
  });

  it('rejects a duplicate room name', async () => {
    await service.createRoom('standup', 'Ada');
    await expect(service.createRoom('standup', 'Bo')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a knock to a non-existent room', () => {
    expect(() => service.knock('ghost', 'Bo')).toThrow(NotFoundException);
  });

  it('admits a guest, minting a guest token delivered via poll', async () => {
    await service.createRoom('standup', 'Ada');
    const { knockId } = service.knock('standup', 'Bo');

    expect(service.knockStatus('standup', knockId).status).toBe('pending');

    await service.admit('standup', knockId);
    const status = service.knockStatus('standup', knockId);
    expect(status.status).toBe('admitted');
    expect(status.token).toBe('jwt-token');
    expect(status.livekitUrl).toBe('ws://localhost:7880');
    // host token + guest token
    expect(livekit.mintToken).toHaveBeenCalledTimes(2);
  });

  it('denies a guest', async () => {
    await service.createRoom('standup', 'Ada');
    const { knockId } = service.knock('standup', 'Bo');
    service.deny('standup', knockId);
    expect(service.knockStatus('standup', knockId).status).toBe('denied');
  });
});
