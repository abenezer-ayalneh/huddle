import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, SessionUser, type AuthUser } from '../auth/auth.guard';
import { RecordingsService } from './recordings.service';

// Cross-room recordings for a signed-in host. Separate from the per-room,
// host-key-authorized recording endpoints under /rooms/:room/recordings — this
// one is session-authorized and spans every room the host owns, so the lobby
// can show past recordings without the (now scheduling-only) room list.
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @UseGuards(AuthGuard)
  @Get('mine')
  listMine(@SessionUser() host: AuthUser) {
    return this.recordings.listMine(host.id);
  }
}
