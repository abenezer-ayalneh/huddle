import { Body, Controller, Delete, Get, Header, Param, Post, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, OptionalAuthGuard, OptionalSessionUser, SessionUser, type AuthUser } from '../auth/auth.guard';
import { DownloadTokenGuard } from './download-token.guard';
import { ApproveRecordingDto, CreateRoomDto, KnockDto, MuteDto, MuteOnEntryDto } from './dto/rooms.dto';
import { HostGuard } from './host.guard';
import { Participant, ParticipantGuard, type CallParticipant } from './participant.guard';
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

  // A signed-in Guest who was admitted to the current call can check and use
  // their account-bound Direct Rejoin Grant without creating another Knock.
  @UseGuards(AuthGuard)
  @Get(':room/rejoin')
  directRejoinEligibility(@SessionUser() guest: AuthUser, @Param('room') room: string) {
    return this.rooms.directRejoinEligibility(room, guest);
  }

  @UseGuards(AuthGuard)
  @Post(':room/rejoin')
  directRejoin(@SessionUser() guest: AuthUser, @Param('room') room: string) {
    return this.rooms.directRejoin(room, guest);
  }

  // --- Public room info (for a guest landing on the link) ---
  @Get(':room')
  getPublic(@Param('room') room: string) {
    return this.rooms.getPublic(room);
  }

  // --- Guest waiting-room flow (public; knockId is the bearer) ---
  // A signed-in guest's name and Avatar are taken from their session and the body
  // name is ignored; an anonymous guest's name rides the body (docs/adr/0016).
  @UseGuards(OptionalAuthGuard)
  @Post(':room/knock')
  knock(@Param('room') room: string, @OptionalSessionUser() user: AuthUser | null, @Body() dto: KnockDto) {
    return this.rooms.knock(room, user?.name ?? dto.name, user?.image, user?.id);
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

  // --- Request to Record (docs/adr/0011) ---
  // The requester stops the recording they were approved for, authorized by
  // their own LiveKit token (x-participant-token) matched against the
  // recording's starter. The host can always stop via the host-key route below.
  @UseGuards(ParticipantGuard)
  @Post(':room/recordings/stop-by-participant')
  stopRecordingAsParticipant(@Param('room') room: string, @Participant() participant: CallParticipant) {
    return this.recordings.stopAsParticipant(room, participant);
  }

  // Final, explicit consent for a signed-in participant to receive eligible
  // recordings through the Host's private Google Drive file. Both a session and
  // their exact LiveKit token are required; anonymous Guests cannot opt in.
  @UseGuards(AuthGuard, ParticipantGuard)
  @Post(':room/recording-share-consent')
  recordingShareConsent(@Param('room') room: string, @SessionUser() user: AuthUser, @Participant() participant: CallParticipant) {
    return this.recordings.giveRecordingShareConsent(room, user, participant);
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
  @Post(':room/mute-on-entry')
  muteOnEntry(@Param('room') room: string, @Body() dto: MuteOnEntryDto) {
    return this.rooms.setMuteOnEntry(room, dto.muted);
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

  // Host approves a participant's Request to Record (docs/adr/0011): approval
  // starts the recording immediately, attributed to that participant so they can
  // stop it. Deny is purely a client-side data message — nothing to persist.
  @UseGuards(HostGuard)
  @Post(':room/recordings/approve')
  approveRecording(@Param('room') room: string, @Body() dto: ApproveRecordingDto) {
    return this.recordings.startForParticipant(room, dto.identity);
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

  // Stream the finished MP4 back to the host. Authorized by a short-lived signed
  // `?token=` (docs/adr/0022) instead of the x-host-key header, so this can be a
  // plain `<a download>` navigation and the browser drives the download natively
  // (progress shelf). Still proxied, so bucket creds never reach the browser.
  @UseGuards(DownloadTokenGuard)
  @Get(':room/recordings/:id/download')
  @Header('Content-Type', 'video/mp4')
  async downloadRecording(@Param('room') room: string, @Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { body, size, filename } = await this.recordings.download(room, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (size != null) res.setHeader('Content-Length', String(size));
    return new StreamableFile(body);
  }
}
