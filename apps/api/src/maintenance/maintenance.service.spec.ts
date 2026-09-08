import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceService, WARNING_MS } from './maintenance.service';
import type { PrismaService } from '../prisma/prisma.service';

function setup(owner = 'owner-id') {
  type Row = { enabled: boolean; startsAt: Date; message: string; actorId: string };
  let row: Row | null = null;
  const tx = {
    $executeRaw: jest.fn(),
    maintenanceCleanup: { count: jest.fn(() => Promise.resolve(0)) },
    maintenanceState: {
      findUnique: jest.fn(() => Promise.resolve(row)),
      upsert: jest.fn(({ create, update }: { create: Row; update: Row }) => {
        row = row ? { ...row, ...update } : create;
        return Promise.resolve(row);
      }),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) => run(tx)) };
  const service = new MaintenanceService(prisma as unknown as PrismaService, new ConfigService({ MAINTENANCE_OWNER_USER_ID: owner }));
  return { service, tx };
}

describe('maintenance owner and deadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it('starts disabled without a settings row', async () => {
    expect(await setup().service.status()).toMatchObject({ phase: 'off', startsAt: null });
  });
  it.each([undefined, '', 'room-host', 'other-user'])('denies non-owner %s', (id) => {
    const { service, tx } = setup();
    expect(() => service.requireOwner(id)).toThrow(ForbiddenException);
    expect(tx.maintenanceState.upsert).not.toHaveBeenCalled();
  });
  it('denies all users if the owner setting is empty', () => {
    expect(setup('').service.isOwner('owner-id')).toBe(false);
  });
  it('gives the full five minute window and blocks admission immediately', async () => {
    const { service } = setup();
    const start = Date.now();
    const result = await service.change(true, 'Be back soon', 'owner-id');
    expect(result.phase).toBe('scheduled');
    expect(Date.parse(result.startsAt!)).toBe(start + WARNING_MS);
    await expect(service.requireAdmissionsOpen()).rejects.toBeInstanceOf(ServiceUnavailableException);
    jest.advanceTimersByTime(WARNING_MS - 1);
    expect((await service.status()).phase).toBe('scheduled');
    jest.advanceTimersByTime(1);
    expect((await service.status()).phase).toBe('active');
  });
  it('retries never extend an existing deadline', async () => {
    const { service } = setup();
    const first = await service.change(true, undefined, 'owner-id');
    jest.advanceTimersByTime(120_000);
    expect((await service.change(true, undefined, 'owner-id')).startsAt).toBe(first.startsAt);
  });
  it('cancels and reopens admission, then creates a fresh warning on re-enable', async () => {
    const { service } = setup();
    const first = await service.change(true, undefined, 'owner-id');
    jest.advanceTimersByTime(50_000);
    expect((await service.change(false, undefined, 'owner-id')).phase).toBe('off');
    await expect(service.requireAdmissionsOpen()).resolves.toBeUndefined();
    expect((await service.change(true, undefined, 'owner-id')).startsAt).not.toBe(first.startsAt);
  });
});
