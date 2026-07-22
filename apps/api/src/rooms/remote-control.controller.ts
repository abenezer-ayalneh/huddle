import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Participant, ParticipantGuard, type CallParticipant } from './participant.guard';
import { RedeemControlAgentTokenDto, RequestRemoteControlDto } from './dto/remote-control.dto';
import { RemoteControlService } from './remote-control.service';

// Human Remote Control actions are participant-token-authorized. The helper
// redemption route is deliberately bearer-only: the one-time bootstrap code is
// the only credential the native app receives from the browser.
@Controller('rooms/:room/remote-control')
export class RemoteControlController {
  constructor(private readonly remoteControl: RemoteControlService) {}

  @UseGuards(ParticipantGuard)
  @Post('requests')
  async request(@Param('room') room: string, @Body() dto: RequestRemoteControlDto, @Participant() participant: CallParticipant) {
    return this.remoteControl.requestControl(room, participant, dto.sharerIdentity);
  }

  @UseGuards(ParticipantGuard)
  @Get('requests/:requestId')
  async getRequest(@Param('room') room: string, @Param('requestId') requestId: string, @Participant() participant: CallParticipant) {
    return this.remoteControl.getRequest(room, requestId, participant);
  }

  @UseGuards(ParticipantGuard)
  @Post('requests/:requestId/approve')
  @HttpCode(200)
  async approve(@Param('room') room: string, @Param('requestId') requestId: string, @Participant() participant: CallParticipant) {
    return this.remoteControl.approve(room, requestId, participant);
  }

  @UseGuards(ParticipantGuard)
  @Post('requests/:requestId/deny')
  @HttpCode(200)
  async deny(@Param('room') room: string, @Param('requestId') requestId: string, @Participant() participant: CallParticipant) {
    return this.remoteControl.deny(room, requestId, participant);
  }

  @Post(':sessionId/helper-token')
  @HttpCode(200)
  async helperToken(@Param('room') room: string, @Param('sessionId') sessionId: string, @Body() dto: RedeemControlAgentTokenDto) {
    return this.remoteControl.redeemHelperToken(room, sessionId, dto.bootstrapCode);
  }

  @UseGuards(ParticipantGuard)
  @Post(':sessionId/stop')
  @HttpCode(200)
  async stop(@Param('room') room: string, @Param('sessionId') sessionId: string, @Participant() participant: CallParticipant) {
    return this.remoteControl.stop(room, sessionId, participant);
  }

  @UseGuards(ParticipantGuard)
  @Post(':sessionId/renew')
  @HttpCode(200)
  async renew(@Param('room') room: string, @Param('sessionId') sessionId: string, @Participant() participant: CallParticipant) {
    return this.remoteControl.renew(room, sessionId, participant);
  }
}
