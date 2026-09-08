import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaintenanceService } from './maintenance.service';

const BLOCK_DURING_MAINTENANCE = 'huddle:block-during-maintenance';
export const BlockDuringMaintenance = () => SetMetadata(BLOCK_DURING_MAINTENANCE, true);

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    // Bind to the resolved handler, not URL text: casing, percent encoding,
    // trailing slashes and router aliases cannot bypass the policy.
    if (this.reflector.get<boolean>(BLOCK_DURING_MAINTENANCE, context.getHandler())) {
      await this.maintenance.requireAdmissionsOpen();
    }
    return true;
  }
}
