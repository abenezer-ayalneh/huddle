import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, MaxLength } from 'class-validator';
import { HostGuard } from './host.guard';
import { InvitationsService } from './invitations.service';
import { BlockDuringMaintenance } from '../maintenance/maintenance.guard';

export class InviteDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

@Controller('rooms/:room/invitations')
@UseGuards(HostGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post()
  @BlockDuringMaintenance()
  send(@Param('room') room: string, @Body() dto: InviteDto) {
    return this.invitations.send(room, dto.email);
  }
}
