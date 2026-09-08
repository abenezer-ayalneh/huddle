import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaintenanceGuard } from './maintenance.guard';
import type { MaintenanceService } from './maintenance.service';
import { RoomsController } from '../rooms/rooms.controller';
import { RemoteControlController } from '../rooms/remote-control.controller';

function check(handler: (...args: never[]) => unknown) {
  const requireAdmissionsOpen = jest.fn(() => Promise.reject(new Error('maintenance')));
  const guard = new MaintenanceGuard({ requireAdmissionsOpen } as unknown as MaintenanceService, new Reflector());
  return guard.canActivate({ getHandler: () => handler } as unknown as ExecutionContext);
}
describe('maintenance admission boundary', () => {
  it.each(['create', 'hostJoin', 'directRejoin', 'knock', 'knockStatus', 'admit', 'startRecording', 'approveRecording'] as const)(
    'blocks resolved rooms handler %s independent of URL spelling',
    async (name) => {
      await expect(check(RoomsController.prototype[name])).rejects.toThrow('maintenance');
    },
  );
  it.each(['request', 'approve', 'helperToken', 'reissueBootstrap', 'renew'] as const)('blocks new remote control work: %s', async (name) => {
    await expect(check(RemoteControlController.prototype[name])).rejects.toThrow('maintenance');
  });
  it('preserves remote control stop for safety', async () => {
    // Reflection inspects this method; it is never called without its instance.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    await expect(check(RemoteControlController.prototype.stop)).resolves.toBe(true);
  });
});
