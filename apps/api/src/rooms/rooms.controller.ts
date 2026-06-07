import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, SessionUser, type AuthUser } from '../auth/auth.guard';
import { CreateRoomDto, KnockDto, MuteDto } from './dto/rooms.dto';
import { HostGuard } from './host.guard';
import { RecordingsService } from './recordings.service';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly recordings: RecordingsService,
  ) {}

  // --- Signed-in host: create / list / rejoin (BetterAuth session) ---
  @UseGuards(AuthGuard)
  @Post()
  create(@SessionUser() host: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.createRoom(host, { scheduledStart: dto.scheduledStart });
  }

  @UseGuards(AuthGuard)
  @Get('mine')
  listMine(@SessionUser() host: AuthUser) {
    return this.rooms.listMine(host.id);
  }

  // Owner mints a fresh host token to (re)join their own room.
  @UseGuards(AuthGuard)
  @Post(':room/host-token')
  hostJoin(@SessionUser() host: AuthUser, @Param('room') room: string) {
    return this.rooms.hostJoin(room, host);
  }

  // --- Public room info (for a guest landing on the link) ---
  @Get(':room')
  getPublic(@Param('room') room: string) {
    return this.rooms.getPublic(room);
  }

  // --- Guest waiting-room flow (public; knockId is the bearer) ---
  @Post(':room/knock')
  knock(@Param('room') room: string, @Body() dto: KnockDto) {
    return this.rooms.knock(room, dto.name);
  }

  @Get(':room/knock/:knockId')
  knockStatus(@Param('room') room: string, @Param('knockId') knockId: string) {
    return this.rooms.knockStatus(room, knockId);
  }

  // Guest withdraws their own pending request (knockId is the bearer).
  @Delete(':room/knock/:knockId')
  cancelKnock(@Param('room') room: string, @Param('knockId') knockId: string) {
    return this.rooms.cancelKnock(room, knockId);
  }

  // --- Host-only endpoints (x-host-key) ---
  @UseGuards(HostGuard)
  @Get(':room/knocks')
  listKnocks(@Param('room') room: string) {
    return this.rooms.listKnocks(room);
  }

  @UseGuards(HostGuard)
  @Post(':room/knocks/:knockId/admit')
  admit(@Param('room') room: string, @Param('knockId') knockId: string) {
    return this.rooms.admit(room, knockId);
  }

  @UseGuards(HostGuard)
  @Post(':room/knocks/:knockId/deny')
  deny(@Param('room') room: string, @Param('knockId') knockId: string) {
    return this.rooms.deny(room, knockId);
  }

  @UseGuards(HostGuard)
  @Post(':room/mute')
  mute(@Param('room') room: string, @Body() dto: MuteDto) {
    return this.rooms.mute(room, dto.identity, dto.muted);
  }

  @UseGuards(HostGuard)
  @Delete(':room/participants/:identity')
  remove(@Param('room') room: string, @Param('identity') identity: string) {
    return this.rooms.remove(room, identity);
  }

  // --- Host-only recording (x-host-key) ---
  @UseGuards(HostGuard)
  @Post(':room/recordings')
  startRecording(@Param('room') room: string) {
    return this.recordings.start(room);
  }

  @UseGuards(HostGuard)
  @Get(':room/recordings')
  listRecordings(@Param('room') room: string) {
    return this.recordings.list(room);
  }

  @UseGuards(HostGuard)
  @Post(':room/recordings/:id/stop')
  stopRecording(@Param('room') room: string, @Param('id') id: string) {
    return this.recordings.stop(room, id);
  }

  // Stream the finished MP4 back to the host. The browser fetches this with the
  // x-host-key header (so a plain <a download> can't be used — the client turns
  // the response into a blob). Proxied so bucket creds never reach the browser.
  @UseGuards(HostGuard)
  @Get(':room/recordings/:id/download')
  @Header('Content-Type', 'video/mp4')
  async downloadRecording(
    @Param('room') room: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { body, size, filename } = await this.recordings.download(room, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (size != null) res.setHeader('Content-Length', String(size));
    return new StreamableFile(body);
  }
}
