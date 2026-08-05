import { Controller, Delete, Get, HttpException, Logger, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthGuard, SessionUser, type AuthUser } from '../auth/auth.guard';
import { RecordingDeliveryService } from './recording-delivery.service';
import { StorageConnectionsService } from './storage-connections.service';

@Controller('storage-connections/google-drive')
export class StorageConnectionsController {
  private readonly logger = new Logger(StorageConnectionsController.name);

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
    } catch (error) {
      this.logGoogleDriveCallbackFailure(error);
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

  private logGoogleDriveCallbackFailure(error: unknown): void {
    // The browser only receives a generic outcome. Keep detailed diagnostics in
    // server logs, while only logging known-safe configuration/OAuth messages.
    if (error instanceof HttpException) {
      this.logger.warn(`Google Drive OAuth callback failed (HTTP ${error.getStatus()}): ${error.message}`);
      return;
    }

    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : '';
    const name = error instanceof Error ? error.name : 'UnknownError';
    this.logger.warn(`Google Drive OAuth callback failed: ${name}${code}`);
  }
}
