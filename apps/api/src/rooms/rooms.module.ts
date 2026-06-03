import { Module } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, WebhookController],
  providers: [RoomsService, RoomStateService, LivekitService],
})
export class RoomsModule {}
