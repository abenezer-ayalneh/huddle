import { Module } from '@nestjs/common';
import { DownloadTokenGuard } from './download-token.guard';
import { DownloadTokenService } from './download-token.service';
import { EgressService } from './egress.service';
import { HostGuard } from './host.guard';
import { LivekitService } from './livekit.service';
import { ParticipantGuard } from './participant.guard';
import { RecordingsController } from './recordings.controller';
import { RecordingRepository } from './recordings.repo';
import { RecordingsService } from './recordings.service';
import { RemoteControlController } from './remote-control.controller';
import { RemoteControlRepository } from './remote-control.repo';
import { RemoteControlService } from './remote-control.service';
import { RemoteControlStateService } from './remote-control.state';
import { RoomRepository } from './rooms.repo';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { StorageService } from './storage.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, RecordingsController, RemoteControlController, WebhookController],
  providers: [
    RoomsService,
    RoomRepository,
    RoomStateService,
    LivekitService,
    HostGuard,
    ParticipantGuard,
    DownloadTokenGuard,
    DownloadTokenService,
    RecordingsService,
    RecordingRepository,
    EgressService,
    StorageService,
    RemoteControlService,
    RemoteControlRepository,
    RemoteControlStateService,
  ],
})
export class RoomsModule {}
