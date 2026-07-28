import { Module } from '@nestjs/common';
import { DownloadTokenGuard } from './download-token.guard';
import { DownloadTokenService } from './download-token.service';
import { EgressService } from './egress.service';
import { GoogleDriveService } from './google-drive.service';
import { HostGuard } from './host.guard';
import { LivekitService } from './livekit.service';
import { ParticipantGuard } from './participant.guard';
import { RecordingsController } from './recordings.controller';
import { RecordingRepository } from './recordings.repo';
import { RecordingsService } from './recordings.service';
import { RecordingDeliveryService } from './recording-delivery.service';
import { RecordingDeliveryWorker } from './recording-delivery.worker';
import { RecordingNoticeService } from './recording-notice.service';
import { RemoteControlController } from './remote-control.controller';
import { RemoteControlRepository } from './remote-control.repo';
import { RemoteControlService } from './remote-control.service';
import { RemoteControlStateService } from './remote-control.state';
import { RoomRepository } from './rooms.repo';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomStateService } from './rooms.state';
import { StorageService } from './storage.service';
import { SecretCryptoService } from './secret-crypto.service';
import { StorageConnectionsController } from './storage-connections.controller';
import { StorageConnectionsService } from './storage-connections.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [RoomsController, RecordingsController, StorageConnectionsController, RemoteControlController, WebhookController],
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
    SecretCryptoService,
    StorageConnectionsService,
    GoogleDriveService,
    RecordingDeliveryService,
    RecordingDeliveryWorker,
    RecordingNoticeService,
    RemoteControlService,
    RemoteControlRepository,
    RemoteControlStateService,
  ],
})
export class RoomsModule {}
