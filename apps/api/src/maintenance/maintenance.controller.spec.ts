import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { MaintenanceController } from './maintenance.controller';
import type { MaintenanceService } from './maintenance.service';

it('requires the exact configured browser origin before any mutation', () => {
  const service = { change: jest.fn(), requireOwner: jest.fn(), status: jest.fn() };
  const controller = new MaintenanceController(service as unknown as MaintenanceService, new ConfigService({ WEB_ORIGIN: 'https://huddle.example' }));
  const user = { id: 'owner', name: 'Owner', email: 'owner@example.test' };
  for (const origin of [undefined, 'null', 'https://evil.example', 'https://huddle.example.evil.test']) {
    expect(() => controller.change(user, { headers: { origin } } as Request, { enabled: true })).toThrow(ForbiddenException);
  }
  expect(service.change).not.toHaveBeenCalled();
  void controller.change(user, { headers: { origin: 'https://huddle.example' } } as Request, { enabled: true });
  expect(service.change).toHaveBeenCalledWith(true, undefined, 'owner');
});
