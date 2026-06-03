import { RoomStateService } from './rooms.state';

describe('RoomStateService', () => {
  let state: RoomStateService;

  beforeEach(() => {
    state = new RoomStateService();
  });

  it('creates a room with a host key and resolves the host', () => {
    const room = state.createRoom('standup', 'host-abc');
    expect(room.hostKey).toHaveLength(32); // 24 random bytes, base64url
    expect(state.isHost('standup', room.hostKey)).toBe(true);
    expect(state.isHost('standup', 'wrong')).toBe(false);
    expect(state.isHost('standup', undefined)).toBe(false);
    expect(state.isHost('other', room.hostKey)).toBe(false);
  });

  it('tracks pending knocks and only lists pending ones', () => {
    state.createRoom('standup', 'host-abc');
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

  it('removeRoom drops the room and its knocks', () => {
    state.createRoom('standup', 'host-abc');
    const k = state.addKnock('standup', 'Ada');
    state.removeRoom('standup');
    expect(state.getRoom('standup')).toBeUndefined();
    expect(state.getKnock('standup', k.knockId)).toBeUndefined();
  });
});
