import { Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthGuard, SessionUser, type AuthUser } from '../auth/auth.guard';
import { RecordingDeliveryService } from './recording-delivery.service';
import { StorageConnectionsService } from './storage-connections.service';

@Controller('storage-connections/google-drive')
export class StorageConnectionsController {
  constructor(
    private readonly connections: StorageConnectionsService,
    private readonly delivery: RecordingDeliveryService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(AuthGuard)
  @Get()
  status(@SessionUser() user: AuthUser) {
    return this.connections.statusFor(user.id);
  }

  @UseGuards(AuthGuard)
  @Post()
  begin(@SessionUser() user: AuthUser) {
    return this.connections.beginGoogleDrive(user.id);
  }

  @Get('callback')
  async callback(@Query('state') state: string, @Query('code') code: string, @Res() res: Response) {
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    try {
      const userId = await this.connections.completeGoogleDrive(state, code);
      await this.delivery.resumeActionRequired(userId);
      return res.redirect(`${webOrigin}/recordings?drive=connected`);
    } catch {
      return res.redirect(`${webOrigin}/recordings?drive=error`);
    }
  }

  @UseGuards(AuthGuard)
  @Delete()
  async disconnect(@SessionUser() user: AuthUser) {
    await this.connections.disconnect(user.id);
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Post('backfill')
  async backfill(@SessionUser() user: AuthUser) {
    return this.delivery.queueBackfill(user.id);
  }
}
