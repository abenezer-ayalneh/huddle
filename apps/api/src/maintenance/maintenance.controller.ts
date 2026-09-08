import { Body, Controller, ForbiddenException, Get, Header, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AuthGuard, OptionalAuthGuard, OptionalSessionUser, SessionUser, type AuthUser } from '../auth/auth.guard';
import { MaintenanceService } from './maintenance.service';

class ChangeMaintenanceDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() @MaxLength(500) message?: string;
}

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.maintenance.status();
  }

  @Get('access')
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalAuthGuard)
  access(@OptionalSessionUser() user: AuthUser | null) {
    return { owner: this.maintenance.isOwner(user?.id) };
  }

  @Get('admin')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  admin(@SessionUser() user: AuthUser) {
    this.maintenance.requireOwner(user.id);
    return this.maintenance.status();
  }

  @Post('admin')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  change(@SessionUser() user: AuthUser, @Req() req: Request, @Body() dto: ChangeMaintenanceDto) {
    // Session cookies alone do not establish user intent. Require the exact
    // configured web origin; shell operations use the private operator CLI.
    const origin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    if (req.headers.origin !== origin) throw new ForbiddenException('Invalid request origin');
    return this.maintenance.change(dto.enabled, dto.message, user.id);
  }
}
