import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BlockDuringMaintenance } from '../maintenance/maintenance.guard';
import { Participant, ParticipantGuard, type CallParticipant } from './participant.guard';
import { ChatFilesService, MAX_CHAT_FILE_BYTES } from './chat-files.service';

export class CreateChatFileDto {
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @IsInt() @Min(0) @Max(MAX_CHAT_FILE_BYTES) size!: number;
}

@Controller('rooms/:room/chat-files')
export class ChatFilesController {
  constructor(private readonly files: ChatFilesService) {}
  @Post()
  @UseGuards(ParticipantGuard)
  @BlockDuringMaintenance()
  create(@Param('room') room: string, @Participant() participant: CallParticipant, @Body() dto: CreateChatFileDto) {
    return this.files.create(room, participant, dto.name, dto.size);
  }
  @Put(':id/parts/:part')
  @UseGuards(ParticipantGuard)
  @BlockDuringMaintenance()
  part(
    @Param('room') room: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('part', ParseIntPipe) part: number,
    @Participant() participant: CallParticipant,
    @Req() req: Request,
  ) {
    return this.files.uploadPart(room, id, participant, part, Number(req.headers['content-length']), req);
  }
  @Post(':id/complete')
  @UseGuards(ParticipantGuard)
  @BlockDuringMaintenance()
  complete(@Param('room') room: string, @Param('id', ParseUUIDPipe) id: string, @Participant() participant: CallParticipant) {
    return this.files.complete(room, id, participant);
  }
  @Delete(':id')
  @UseGuards(ParticipantGuard)
  cancel(@Param('room') room: string, @Param('id', ParseUUIDPipe) id: string, @Participant() participant: CallParticipant) {
    return this.files.cancel(room, id, participant);
  }
  @Get(':id')
  @UseGuards(ParticipantGuard)
  info(@Param('room') room: string, @Param('id', ParseUUIDPipe) id: string, @Participant() participant: CallParticipant) {
    return this.files.info(room, id, participant);
  }
  @Get(':id/download')
  async download(
    @Param('room') room: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.files.download(room, id, token);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`,
    );
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return new StreamableFile(file.body);
  }
}
