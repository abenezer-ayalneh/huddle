import type Redis from 'ioredis';
import { FakeRedis } from '../redis/fake-redis';
import { RoomStateService } from './rooms.state';

describe('RoomStateService', () => {
  let state: RoomStateService;

  beforeEach(() => {
    state = new RoomStateService(new FakeRedis() as unknown as Redis);
  });

  it('tracks pending knocks and only lists pending ones', async () => {
    const a = await state.addKnock('standup', 'Ada');
    await state.addKnock('standup', 'Bo');

    expect(await state.listPendingKnocks('standup')).toHaveLength(2);

    await state.resolveKnock(a, 'admitted', {
      identity: 'ada-1',
      token: 'jwt',
    });
    const refreshed = await state.getKnock('standup', a.knockId);
    expect(refreshed?.status).toBe('admitted');
    expect(refreshed?.token).toBe('jwt');
    expect(await state.listPendingKnocks('standup')).toHaveLength(1);
  });

  it('scopes knock lookup to its room', async () => {
    const k = await state.addKnock('standup', 'Ada');
    expect(await state.getKnock('standup', k.knockId)).toMatchObject({
      knockId: k.knockId,
    });
    expect(await state.getKnock('other', k.knockId)).toBeUndefined();
  });

  it('removeKnock withdraws a pending knock', async () => {
    const k = await state.addKnock('standup', 'Ada');
    await state.removeKnock('standup', k.knockId);
    expect(await state.getKnock('standup', k.knockId)).toBeUndefined();
    expect(await state.listPendingKnocks('standup')).toHaveLength(0);
    // Idempotent — second call is a no-op, not an error.
    await expect(state.removeKnock('standup', k.knockId)).resolves.toBeUndefined();
  });

  it('clearKnocks drops only the named room’s knocks', async () => {
    const a = await state.addKnock('standup', 'Ada');
    const b = await state.addKnock('other', 'Bo');
    await state.clearKnocks('standup');
    expect(await state.getKnock('standup', a.knockId)).toBeUndefined();
    expect(await state.getKnock('other', b.knockId)).toMatchObject({
      knockId: b.knockId,
    });
  });

  it('stores Direct Rejoin Grants by account and stable participant identity', async () => {
    const grant = await state.addDirectRejoinGrant({
      room: 'standup',
      roomSid: 'RM_current',
      userId: 'user-ada',
      identity: 'ada-stable',
    });

    await expect(state.getDirectRejoinGrant('standup', 'user-ada')).resolves.toEqual(grant);
    await expect(state.getDirectRejoinGrantByIdentity('standup', 'ada-stable')).resolves.toEqual(grant);
  });

  it('revokes a Direct Rejoin Grant through its participant identity', async () => {
    await state.addDirectRejoinGrant({
      room: 'standup',
      roomSid: 'RM_current',
      userId: 'user-ada',
      identity: 'ada-stable',
    });

    await expect(state.revokeDirectRejoinGrantByIdentity('standup', 'ada-stable')).resolves.toBeDefined();
    await expect(state.getDirectRejoinGrant('standup', 'user-ada')).resolves.toBeUndefined();
  });

  it('clears only Direct Rejoin Grants belonging to the finished room SID', async () => {
    await state.addDirectRejoinGrant({
      room: 'standup',
      roomSid: 'RM_old',
      userId: 'user-ada',
      identity: 'ada-old',
    });
    await state.addDirectRejoinGrant({
      room: 'standup',
      roomSid: 'RM_new',
      userId: 'user-bo',
      identity: 'bo-new',
    });

    await state.clearDirectRejoinGrants('standup', 'RM_old');
    await expect(state.getDirectRejoinGrant('standup', 'user-ada')).resolves.toBeUndefined();
    await expect(state.getDirectRejoinGrant('standup', 'user-bo')).resolves.toMatchObject({
      roomSid: 'RM_new',
    });
  });
});
