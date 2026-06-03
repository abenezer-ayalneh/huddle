import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HostGuard } from './host.guard';
import { RoomStateService } from './rooms.state';

function contextFor(room: string, hostKey?: string): ExecutionContext {
  const req = {
    params: { room },
    headers: hostKey ? { 'x-host-key': hostKey } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('HostGuard', () => {
  let state: RoomStateService;
  let guard: HostGuard;
  let hostKey: string;

  beforeEach(() => {
    state = new RoomStateService();
    guard = new HostGuard(state);
    hostKey = state.createRoom('standup', 'host-abc').hostKey;
  });

  it('allows the request with a matching host key', () => {
    expect(guard.canActivate(contextFor('standup', hostKey))).toBe(true);
  });

  it('rejects a missing host key', () => {
    expect(() => guard.canActivate(contextFor('standup'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong host key', () => {
    expect(() => guard.canActivate(contextFor('standup', 'nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a valid key used on a different room', () => {
    state.createRoom('other', 'host-xyz');
    expect(() => guard.canActivate(contextFor('other', hostKey))).toThrow(
      UnauthorizedException,
    );
  });
});
