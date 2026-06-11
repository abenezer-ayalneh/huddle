import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Recording, Room } from '@prisma/client';
import { EgressStatus, type EgressInfo } from 'livekit-server-sdk';
import type { EgressService } from './egress.service';
import { RecordingsService } from './recordings.service';
import type { StorageService } from './storage.service';

// In-memory stand-ins for the Prisma-backed repos.
class FakeRoomRepo {
  rooms = new Map<string, Room>();
  seed(slug: string): Room {
    const room = {
      id: `room-${slug}`,
      slug,
      scheduledStart: null,
      hostKey: 'k',
      hostUserId: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Room;
    this.rooms.set(slug, room);
    return room;
  }
  findBySlug(slug: string): Promise<Room | null> {
    return Promise.resolve(this.rooms.get(slug) ?? null);
  }
}

class FakeRecordingRepo {
  rows: Recording[] = [];
  seq = 0;
  create(p: { egressId: string; roomId: string; objectKey: string }) {
    const rec = {
      id: `rec-${++this.seq}`,
      egressId: p.egressId,
      roomId: p.roomId,
      status: 'starting',
      objectKey: p.objectKey,
      sizeBytes: null,
      durationMs: null,
      error: null,
      startedAt: new Date(),
      endedAt: null,
    } as Recording;
    this.rows.push(rec);
    return Promise.resolve(rec);
  }
  findByEgressId(egressId: string) {
    return Promise.resolve(this.rows.find((r) => r.egressId === egressId) ?? null);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.find((r) => r.id === id) ?? null);
  }
  listByRoom(roomId: string) {
    return Promise.resolve(this.rows.filter((r) => r.roomId === roomId));
  }
  listActiveByRoom(roomId: string) {
    return Promise.resolve(this.rows.filter((r) => r.roomId === roomId && ['starting', 'active'].includes(r.status)));
  }
  updateByEgressId(egressId: string, data: Partial<Recording>) {
    const rec = this.rows.find((r) => r.egressId === egressId)!;
    Object.assign(rec, data);
    return Promise.resolve(rec);
  }
}

describe('RecordingsService', () => {
  let rooms: FakeRoomRepo;
  let recordings: FakeRecordingRepo;
  let egress: jest.Mocked<Pick<EgressService, 'startRoomComposite' | 'stop'>>;
  let storage: jest.Mocked<Pick<StorageService, 'ensureBucket' | 'getObject'>>;
  let service: RecordingsService;

  beforeEach(() => {
    rooms = new FakeRoomRepo();
    rooms.seed('standup');
    recordings = new FakeRecordingRepo();
    egress = {
      startRoomComposite: jest.fn().mockResolvedValue({ egressId: 'eg-1' }),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      ensureBucket: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn(),
    };
    service = new RecordingsService(rooms as never, recordings as never, egress as never, storage as never);
  });

  it('starts a recording: ensures the bucket and stores the egress job', async () => {
    const summary = await service.start('standup');
    expect(storage.ensureBucket).toHaveBeenCalled();
    expect(egress.startRoomComposite).toHaveBeenCalledWith('standup', expect.stringMatching(/^standup\/.*\.mp4$/));
    expect(summary.status).toBe('starting');
    expect(recordings.rows).toHaveLength(1);
  });

  it('refuses a second concurrent recording', async () => {
    await service.start('standup');
    await expect(service.start('standup')).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s starting a recording for an unknown room', async () => {
    await expect(service.start('ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('advances status and captures size/duration on egress complete', async () => {
    await service.start('standup');
    const info = {
      egressId: 'eg-1',
      status: EgressStatus.EGRESS_COMPLETE,
      fileResults: [{ size: 1234n, duration: 5_000_000_000n }],
    } as unknown as EgressInfo;
    await service.handleEgressEvent(info);

    const rec = recordings.rows[0];
    expect(rec.status).toBe('completed');
    expect(rec.sizeBytes).toBe(1234n);
    expect(rec.durationMs).toBe(5000);
    expect(rec.endedAt).not.toBeNull();
  });

  it('ignores egress events for jobs it does not own', async () => {
    const info = {
      egressId: 'unknown',
      status: EgressStatus.EGRESS_COMPLETE,
    } as unknown as EgressInfo;
    await expect(service.handleEgressEvent(info)).resolves.toBeUndefined();
  });

  it('refuses to download a recording that is not complete', async () => {
    const { id } = await service.start('standup');
    await expect(service.download('standup', id)).rejects.toBeInstanceOf(ConflictException);
  });
});
