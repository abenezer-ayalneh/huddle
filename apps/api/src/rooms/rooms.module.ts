import { Module } from '@nestjs/common';
import { EgressService } from './egress.service';
import { HostGuard } from './host.guard';
import { LivekitService } from './livekit.service';
import { RecordingRepository } from './recordings.repo';
import { RecordingsService } from './recordings.service';
import { RoomRepository } from './rooms.repo';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { StorageService } from './storage.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, WebhookController],
  providers: [
    RoomsService,
    RoomRepository,
    RoomStateService,
    LivekitService,
    HostGuard,
    RecordingsService,
    RecordingRepository,
    EgressService,
    StorageService,
  ],
})
export class RoomsModule {}
