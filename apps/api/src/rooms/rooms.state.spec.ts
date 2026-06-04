import { RoomStateService } from './rooms.state';

describe('RoomStateService', () => {
  let state: RoomStateService;

  beforeEach(() => {
    state = new RoomStateService();
  });

  it('tracks pending knocks and only lists pending ones', () => {
    const a = state.addKnock('standup', 'Ada');
    state.addKnock('standup', 'Bo');

    expect(state.listPendingKnocks('standup')).toHaveLength(2);

    state.resolveKnock(a, 'admitted', { identity: 'ada-1', token: 'jwt' });
    expect(a.status).toBe('admitted');
    expect(a.token).toBe('jwt');
    expect(state.listPendingKnocks('standup')).toHaveLength(1);
  });

  it('scopes knock lookup to its room', () => {
    const k = state.addKnock('standup', 'Ada');
    expect(state.getKnock('standup', k.knockId)).toBe(k);
    expect(state.getKnock('other', k.knockId)).toBeUndefined();
  });

  it('removeKnock withdraws a pending knock', () => {
    const k = state.addKnock('standup', 'Ada');
    state.removeKnock('standup', k.knockId);
    expect(state.getKnock('standup', k.knockId)).toBeUndefined();
    expect(state.listPendingKnocks('standup')).toHaveLength(0);
    // Idempotent — second call is a no-op, not an error.
    expect(() => state.removeKnock('standup', k.knockId)).not.toThrow();
  });

  it('clearKnocks drops only the named room’s knocks', () => {
    const a = state.addKnock('standup', 'Ada');
    const b = state.addKnock('other', 'Bo');
    state.clearKnocks('standup');
    expect(state.getKnock('standup', a.knockId)).toBeUndefined();
    expect(state.getKnock('other', b.knockId)).toBe(b);
  });
});
