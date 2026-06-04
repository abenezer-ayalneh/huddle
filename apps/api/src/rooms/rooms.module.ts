import { Module } from '@nestjs/common';
import { HostGuard } from './host.guard';
import { LivekitService } from './livekit.service';
import { RoomRepository } from './rooms.repo';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, WebhookController],
  providers: [
    RoomsService,
    RoomRepository,
    RoomStateService,
    LivekitService,
    HostGuard,
  ],
})
export class RoomsModule {}
