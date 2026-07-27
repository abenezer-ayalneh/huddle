import type Redis from 'ioredis';
import { FakeRedis } from '../redis/fake-redis';
import { RemoteControlStateService, type ActiveRemoteControlGrant, type PendingRemoteControlRequest } from './remote-control.state';

function pending(overrides: Partial<PendingRemoteControlRequest> = {}): PendingRemoteControlRequest {
  return {
    requestId: 'req-1',
    room: 'room-1',
    sharerIdentity: 'sharer',
    sharerName: 'Sharer',
    controllerIdentity: 'controller',
    controllerName: 'Controller',
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    controllerTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function active(overrides: Partial<ActiveRemoteControlGrant> = {}): ActiveRemoteControlGrant {
  const now = Date.now();
  return {
    sessionId: 'session-1',
    room: 'room-1',
    roomId: 'db-room-1',
    sharerIdentity: 'sharer',
    sharerName: 'Sharer',
    controllerIdentity: 'controller',
    controllerName: 'Controller',
    agentIdentity: 'control-agent:req-1',
    status: 'awaiting-agent',
    agentConnected: false,
    startedAt: new Date(now).toISOString(),
    renewalDueAt: new Date(now + 1_800_000).toISOString(),
    authorizationExpiresAt: new Date(now + 3_600_000).toISOString(),
    ...overrides,
  };
}

describe('RemoteControlStateService', () => {
  it('does not let a guessed request id consume the room pending request', async () => {
    const state = new RemoteControlStateService(new FakeRedis() as unknown as Redis);
    expect(await state.createPending(pending())).toBe(true);
    expect((await state.getPendingForRoom('room-1'))?.requestId).toBe('req-1');
    expect(await state.consumePending('room-1', 'guessed')).toBeUndefined();
    expect((await state.getPending('room-1', 'req-1'))?.requestId).toBe('req-1');
    expect((await state.consumePending('room-1', 'req-1'))?.requestId).toBe('req-1');
  });

  it('makes a helper bootstrap one-time and binds it to the active session', async () => {
    const state = new RemoteControlStateService(new FakeRedis() as unknown as Redis);
    const grant = active();
    // The test double is injected through the constructor; activate first so
    // issueBootstrap can update the live grant in the same way Redis does.
    expect(await state.createPending(pending({ requestId: grant.sessionId }))).toBe(true);
    expect(await state.activate(grant)).toBe(true);
    const bootstrap = await state.issueBootstrap(grant);
    expect(await state.consumeBootstrap('room-1', grant.sessionId, bootstrap.bootstrapCode)).toBeTruthy();
    expect(await state.consumeBootstrap('room-1', grant.sessionId, bootstrap.bootstrapCode)).toBeUndefined();
  });

  it('rotates a bootstrap so the previous bearer is revoked', async () => {
    const state = new RemoteControlStateService(new FakeRedis() as unknown as Redis);
    const grant = active();
    expect(await state.createPending(pending({ requestId: grant.sessionId }))).toBe(true);
    expect(await state.activate(grant)).toBe(true);

    const first = await state.issueBootstrap(grant);
    const current = await state.getActive('room-1');
    expect(current?.bootstrapDigest).toBeTruthy();
    const second = await state.issueBootstrap(current!);

    expect(await state.consumeBootstrap('room-1', grant.sessionId, first.bootstrapCode)).toBeUndefined();
    expect(await state.consumeBootstrap('room-1', grant.sessionId, second.bootstrapCode)).toBeTruthy();
  });
});
