import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Room } from '@prisma/client';
import { HostGuard } from './host.guard';
import { RoomRepository } from './rooms.repo';

function contextFor(room: string, hostKey?: string): ExecutionContext {
  const req = {
    params: { room },
    headers: hostKey ? { 'x-host-key': hostKey } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function fakeRoom(slug: string, hostKey: string): Room {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    scheduledStart: null,
    hostKey,
    hostUserId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('HostGuard', () => {
  let guard: HostGuard;
  const hostKey = 'secret-key';
  const rooms = new Map<string, Room>([
    ['standup', fakeRoom('standup', hostKey)],
    ['other', fakeRoom('other', 'different-key')],
  ]);

  beforeEach(() => {
    const repo = {
      findBySlug: (slug: string) => Promise.resolve(rooms.get(slug) ?? null),
    } as unknown as RoomRepository;
    guard = new HostGuard(repo);
  });

  it('allows the request with a matching host key', async () => {
    await expect(
      guard.canActivate(contextFor('standup', hostKey)),
    ).resolves.toBe(true);
  });

  it('rejects a missing host key', async () => {
    await expect(guard.canActivate(contextFor('standup'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong host key', async () => {
    await expect(
      guard.canActivate(contextFor('standup', 'nope')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a valid key used on a different room', async () => {
    await expect(
      guard.canActivate(contextFor('other', hostKey)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the room does not exist', async () => {
    await expect(
      guard.canActivate(contextFor('ghost', hostKey)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
