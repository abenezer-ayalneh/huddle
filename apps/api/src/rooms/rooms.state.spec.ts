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
});
