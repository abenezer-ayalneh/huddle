import {
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LivekitService } from './livekit.service';
import { RoomsService } from './rooms.service';

// Receives LiveKit server events. The body is signed with the API key; we
// verify it with WebhookReceiver before acting. Needs the raw request body
// (main.ts enables rawBody), since the signature covers the exact bytes.
@Controller('livekit')
export class WebhookController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly rooms: RoomsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    let event;
    try {
      event = await this.livekit.receiveWebhook(raw, req.headers.authorization);
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (event.event === 'room_finished' && event.room?.name) {
      this.rooms.onRoomFinished(event.room.name);
    }
    return { received: true };
  }
}
