import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Room } from '@prisma/client';
import type Redis from 'ioredis';
import type { AuthUser } from '../auth/auth.guard';
import { FakeRedis } from '../redis/fake-redis';
import { LivekitService } from './livekit.service';
import { RoomRepository } from './rooms.repo';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';

// Minimal in-memory stand-in for the Prisma-backed repository.
class FakeRoomRepo {
  private rooms = new Map<string, Room>();
  private seq = 0;

  create(params: {
    title: string;
    slug?: string;
    scheduledStart?: Date | null;
    hostUserId: string;
  }): Promise<Room> {
    const slug = params.slug ?? params.title.toLowerCase().replace(/\s+/g, '-');
    const room: Room = {
      id: `id-${++this.seq}`,
      slug,
      title: params.title,
      scheduledStart: params.scheduledStart ?? null,
      hostKey: `key-${this.seq}`,
      hostUserId: params.hostUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rooms.set(slug, room);
    return Promise.resolve(room);
  }

  findBySlug(slug: string): Promise<Room | null> {
    return Promise.resolve(this.rooms.get(slug) ?? null);
  }

  listByHost(hostUserId: string): Promise<Room[]> {
    return Promise.resolve(
      [...this.rooms.values()].filter((r) => r.hostUserId === hostUserId),
    );
  }
}

const ada: AuthUser = { id: 'user-ada', name: 'Ada', email: 'ada@x.dev' };
const bo: AuthUser = { id: 'user-bo', name: 'Bo', email: 'bo@x.dev' };

describe('RoomsService', () => {
  let repo: FakeRoomRepo;
  let state: RoomStateService;
  let livekit: jest.Mocked<Pick<LivekitService, 'createRoom' | 'mintToken'>> & {
    livekitUrl: string;
  };
  let service: RoomsService;

  beforeEach(() => {
    repo = new FakeRoomRepo();
    state = new RoomStateService(new FakeRedis() as unknown as Redis);
    livekit = {
      livekitUrl: 'ws://localhost:7880',
      createRoom: jest.fn().mockResolvedValue(undefined),
      mintToken: jest.fn().mockResolvedValue('jwt-token'),
    };
    service = new RoomsService(
      repo as unknown as RoomRepository,
      state,
      livekit as unknown as LivekitService,
    );
  });

  it('creates a room and mints a host token', async () => {
    const res = await service.createRoom(ada, { title: 'Standup' });
    expect(livekit.createRoom).toHaveBeenCalledWith('standup');
    expect(livekit.mintToken).toHaveBeenCalledWith(
      expect.objectContaining({ room: 'standup', host: true }),
    );
    expect(res.token).toBe('jwt-token');
    expect(res.hostKey).toEqual(expect.any(String));
    expect(res.title).toBe('Standup');
  });

  it('lists only the rooms a host owns, exposing host keys', async () => {
    await service.createRoom(ada, { title: 'Standup' });
    await service.createRoom(bo, { title: 'Retro' });
    const mine = await service.listMine(ada.id);
    expect(mine.rooms).toHaveLength(1);
    expect(mine.rooms[0].room).toBe('standup');
    expect(mine.rooms[0].hostKey).toEqual(expect.any(String));
  });

  it('lets the owner rejoin but forbids a non-owner', async () => {
    await service.createRoom(ada, { title: 'Standup' });
    await expect(service.hostJoin('standup', ada)).resolves.toMatchObject({
      room: 'standup',
    });
    await expect(service.hostJoin('standup', bo)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a knock to a non-existent room', async () => {
    await expect(service.knock('ghost', 'Bo')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('admits a guest, minting a guest token delivered via poll', async () => {
    await service.createRoom(ada, { title: 'Standup' });
    const { knockId } = await service.knock('standup', 'Bo');

    expect((await service.knockStatus('standup', knockId)).status).toBe(
      'pending',
    );

    await service.admit('standup', knockId);
    const status = await service.knockStatus('standup', knockId);
    expect(status.status).toBe('admitted');
    expect(status.token).toBe('jwt-token');
    expect(status.livekitUrl).toBe('ws://localhost:7880');
    // host token (create) + guest token (admit)
    expect(livekit.mintToken).toHaveBeenCalledTimes(2);
  });

  it('denies a guest', async () => {
    await service.createRoom(ada, { title: 'Standup' });
    const { knockId } = await service.knock('standup', 'Bo');
    await service.deny('standup', knockId);
    expect((await service.knockStatus('standup', knockId)).status).toBe(
      'denied',
    );
  });

  it('clears knocks on room_finished without deleting the room', async () => {
    await service.createRoom(ada, { title: 'Standup' });
    const { knockId } = await service.knock('standup', 'Bo');
    await service.onRoomFinished('standup');
    await expect(service.knockStatus('standup', knockId)).rejects.toThrow(
      NotFoundException,
    );
    // Room still exists (persistent) — a fresh knock succeeds.
    await expect(service.knock('standup', 'Cy')).resolves.toHaveProperty(
      'knockId',
    );
  });
});
