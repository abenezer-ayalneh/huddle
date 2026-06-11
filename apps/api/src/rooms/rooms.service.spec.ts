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

  create(params: { scheduledStart?: Date | null; hostUserId: string }): Promise<Room> {
    const slug = `room-${++this.seq}`;
    const room: Room = {
      id: `id-${this.seq}`,
      slug,
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

  // Mirrors the real repo: only the host's future scheduled meetings.
  listByHost(hostUserId: string): Promise<Room[]> {
    const now = Date.now();
    return Promise.resolve([...this.rooms.values()].filter((r) => r.hostUserId === hostUserId && r.scheduledStart != null && r.scheduledStart.getTime() > now));
  }
}

const ada: AuthUser = { id: 'user-ada', name: 'Ada', email: 'ada@x.dev' };
const bo: AuthUser = { id: 'user-bo', name: 'Bo', email: 'bo@x.dev' };

describe('RoomsService', () => {
  let repo: FakeRoomRepo;
  let state: RoomStateService;
  let livekit: jest.Mocked<Pick<LivekitService, 'createRoom' | 'mintToken' | 'getMuteOnEntry'>> & {
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
      getMuteOnEntry: jest.fn().mockResolvedValue(false),
    };
    service = new RoomsService(repo as unknown as RoomRepository, state, livekit as unknown as LivekitService);
  });

  it('creates a room with a generated code and mints a host token', async () => {
    const res = await service.createRoom(ada, {});
    expect(res.room).toEqual(expect.any(String));
    expect(livekit.createRoom).toHaveBeenCalledWith(res.room);
    expect(livekit.mintToken).toHaveBeenCalledWith(expect.objectContaining({ room: res.room, host: true }));
    expect(res.token).toBe('jwt-token');
    expect(res.hostKey).toEqual(expect.any(String));
  });

  it('lists only the host’s upcoming scheduled rooms', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await service.createRoom(ada, {}); // instant — excluded from the list
    const scheduled = await service.createRoom(ada, { scheduledStart: future });
    await service.createRoom(bo, { scheduledStart: future }); // another host
    const mine = await service.listMine(ada.id);
    expect(mine.rooms).toHaveLength(1);
    expect(mine.rooms[0].room).toBe(scheduled.room);
    expect(mine.rooms[0].hostKey).toEqual(expect.any(String));
  });

  it('lets the owner rejoin but forbids a non-owner', async () => {
    const { room } = await service.createRoom(ada, {});
    await expect(service.hostJoin(room, ada)).resolves.toMatchObject({ room });
    await expect(service.hostJoin(room, bo)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a knock to a non-existent room', async () => {
    await expect(service.knock('ghost', 'Bo')).rejects.toThrow(NotFoundException);
  });

  it('admits a guest, minting a guest token delivered via poll', async () => {
    const { room } = await service.createRoom(ada, {});
    const { knockId } = await service.knock(room, 'Bo');

    expect((await service.knockStatus(room, knockId)).status).toBe('pending');

    await service.admit(room, knockId);
    const status = await service.knockStatus(room, knockId);
    expect(status.status).toBe('admitted');
    expect(status.token).toBe('jwt-token');
    expect(status.livekitUrl).toBe('ws://localhost:7880');
    // host token (create) + guest token (admit)
    expect(livekit.mintToken).toHaveBeenCalledTimes(2);
  });

  it('denies a guest', async () => {
    const { room } = await service.createRoom(ada, {});
    const { knockId } = await service.knock(room, 'Bo');
    await service.deny(room, knockId);
    expect((await service.knockStatus(room, knockId)).status).toBe('denied');
  });

  it('clears knocks on room_finished without deleting the room', async () => {
    const { room } = await service.createRoom(ada, {});
    const { knockId } = await service.knock(room, 'Bo');
    await service.onRoomFinished(room);
    await expect(service.knockStatus(room, knockId)).rejects.toThrow(NotFoundException);
    // Room still exists (persistent) — a fresh knock succeeds.
    await expect(service.knock(room, 'Cy')).resolves.toHaveProperty('knockId');
  });
});
