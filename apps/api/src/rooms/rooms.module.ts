import { Module } from '@nestjs/common';
import { ControlAgentController } from './control-agent.controller';
import { ControlAgentService } from './control-agent.service';
import { EgressService } from './egress.service';
import { HostGuard } from './host.guard';
import { LivekitService } from './livekit.service';
import { ParticipantGuard } from './participant.guard';
import { RecordingsController } from './recordings.controller';
import { RecordingRepository } from './recordings.repo';
import { RecordingsService } from './recordings.service';
import { RoomRepository } from './rooms.repo';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { StorageService } from './storage.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, RecordingsController, ControlAgentController, WebhookController],
  providers: [
    RoomsService,
    RoomRepository,
    RoomStateService,
    LivekitService,
    HostGuard,
    ParticipantGuard,
    ControlAgentService,
    RecordingsService,
    RecordingRepository,
    EgressService,
    StorageService,
  ],
})
export class RoomsModule {}
