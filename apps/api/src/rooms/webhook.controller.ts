import { Controller, HttpCode, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { FaultCode, faultBody } from '../common/faults';
import { LivekitService } from './livekit.service';
import { RecordingsService } from './recordings.service';
import { RoomsService } from './rooms.service';
import { RemoteControlService } from './remote-control.service';

// Receives LiveKit server events. The body is signed with the API key; we
// verify it with WebhookReceiver before acting. Needs the raw request body
// (main.ts enables rawBody), since the signature covers the exact bytes.
@Controller('livekit')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly livekit: LivekitService,
    private readonly rooms: RoomsService,
    private readonly recordings: RecordingsService,
    private readonly remoteControl: RemoteControlService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    let event: Awaited<ReturnType<LivekitService['receiveWebhook']>>;
    try {
      event = await this.livekit.receiveWebhook(raw, req.headers.authorization);
    } catch (err) {
      // Log the reason (not the token) — the usual cause is an empty rawBody,
      // which means the body parser didn't capture this content type.
      this.logger.warn(`webhook verify failed (rawLen=${raw.length}): ${String(err)}`);
      throw new UnauthorizedException(faultBody(FaultCode.WEBHOOK_UNVERIFIED, 'Invalid webhook signature'));
    }

    if (event.event === 'participant_joined' && event.room?.name) {
      await this.livekit.stampStartedAt(event.room.name);
      if (event.participant?.identity) {
        await this.remoteControl.onParticipantJoined(event.room.name, event.participant.identity);
      }
    }

    if (event.event === 'participant_left' && event.room?.name && event.participant?.identity) {
      await this.remoteControl.onParticipantLeft(event.room.name, event.participant.identity);
    }

    if (event.event === 'participant_left' && event.room?.name && event.room.numParticipants === 0) {
      await this.livekit.clearStartedAt(event.room.name);
    }

    if (event.event === 'room_finished' && event.room?.name) {
      await this.rooms.onRoomFinished(event.room.name);
      await this.remoteControl.onRoomFinished(event.room.name);
    }

    // Egress lifecycle (Phase 8): started / updated / ended carry the egressInfo
    // we use to advance a recording's status and capture its file size/duration.
    // If the room ends mid-recording, LiveKit stops egress and we learn the
    // final state here, so room_finished needs no extra recording handling.
    if (event.egressInfo) {
      await this.recordings.handleEgressEvent(event.egressInfo);
    }
    return { received: true };
  }
}
