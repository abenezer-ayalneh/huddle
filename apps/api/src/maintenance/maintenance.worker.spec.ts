import { MaintenanceWorker } from './maintenance.worker';
import type { PrismaService } from '../prisma/prisma.service';
import type { LivekitService } from '../rooms/livekit.service';
import type { RoomsService } from '../rooms/rooms.service';
import type { RemoteControlService } from '../rooms/remote-control.service';
import type { EgressService } from '../rooms/egress.service';

function setup(enabled = true, offset = 300_000) {
  const tx = {
    $queryRaw: jest.fn(() => Promise.resolve([{ locked: true }])),
    maintenanceState: { findUnique: jest.fn(() => Promise.resolve({ enabled, startsAt: new Date(Date.now() + offset), message: 'Maintenance' })) },
    recording: { findMany: jest.fn(() => Promise.resolve([{ egressId: 'egress-1' }])) },
  };
  const pending = new Map<string, { roomSid: string; roomName: string }>();
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    maintenanceCleanup: {
      upsert: jest.fn(({ create }: { create: { roomSid: string; roomName: string } }) => {
        pending.set(create.roomSid, create);
      }),
      findMany: jest.fn(() => Promise.resolve([...pending.values()])),
      delete: jest.fn(({ where }: { where: { roomSid: string } }) => {
        pending.delete(where.roomSid);
      }),
    },
  };
  let activeRooms = [{ name: 'room', sid: 'sid' }];
  const livekit = {
    listActiveRooms: jest.fn(() => Promise.resolve(activeRooms)),
    publishMaintenance: jest.fn(),
    endRoom: jest.fn(() => {
      activeRooms = [];
      return Promise.resolve();
    }),
  };
  const rooms = { onRoomFinished: jest.fn() };
  const remote = { onRoomFinished: jest.fn() };
  const egress = { stop: jest.fn() };
  const worker = new MaintenanceWorker(
    prisma as unknown as PrismaService,
    livekit as unknown as LivekitService,
    rooms as unknown as RoomsService,
    remote as unknown as RemoteControlService,
    egress as unknown as EgressService,
  );
  return { worker, tx, livekit, rooms, remote, egress };
}
describe('maintenance shutdown worker', () => {
  it('publishes a warning without ending calls before the deadline', async () => {
    const { worker, livekit } = setup();
    await worker.tick();
    expect(livekit.publishMaintenance).toHaveBeenCalledWith('room', expect.objectContaining({ phase: 'scheduled' }));
    expect(livekit.endRoom).not.toHaveBeenCalled();
  });
  it('publishes cancellation to connected clients', async () => {
    const { worker, livekit } = setup(false);
    await worker.tick();
    expect(livekit.publishMaintenance).toHaveBeenCalledWith('room', expect.objectContaining({ phase: 'off', startsAt: null }));
    expect(livekit.endRoom).not.toHaveBeenCalled();
  });
  it('ends overdue calls after restart and cleans recording, remote control, and grants', async () => {
    const { worker, livekit, rooms, remote, egress } = setup(true, -1);
    await worker.tick();
    expect(remote.onRoomFinished).toHaveBeenCalledWith('room');
    expect(egress.stop).toHaveBeenCalledWith('egress-1');
    expect(livekit.endRoom).toHaveBeenCalledWith('room');
    expect(rooms.onRoomFinished).toHaveBeenCalledWith('room', 'sid');
  });
  it('does not act when another worker holds the lock', async () => {
    const { worker, tx, livekit } = setup(true, -1);
    tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    await worker.tick();
    expect(livekit.listActiveRooms).not.toHaveBeenCalled();
  });
  it('retries a failed room termination on the next sweep', async () => {
    const { worker, livekit } = setup(true, -1);
    livekit.endRoom.mockRejectedValueOnce(new Error('offline'));
    await worker.tick();
    await worker.tick();
    expect(livekit.endRoom).toHaveBeenCalledTimes(2);
  });
});
