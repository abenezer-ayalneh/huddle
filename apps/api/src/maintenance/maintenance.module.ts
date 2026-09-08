import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceGuard } from './maintenance.guard';

@Global()
@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, { provide: APP_GUARD, useClass: MaintenanceGuard }],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
