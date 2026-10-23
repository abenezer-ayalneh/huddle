import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { getAuth } from '../auth/auth';
import { AuthGuard, SessionUser, type AuthUser } from '../auth/auth.guard';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionService } from './account-deletion.service';
import { ProfileService, type AvatarUpload } from './profile.service';

class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

class SetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsString()
  confirmation!: string;
}

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly deletion: AccountDeletionService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(AuthGuard)
  @Get()
  read(@SessionUser() user: AuthUser) {
    return this.profile.read(user.id);
  }

  @UseGuards(AuthGuard)
  @Patch()
  update(@SessionUser() user: AuthUser, @Body() body: UpdateProfileDto) {
    return this.profile.updateName(user.id, body.name);
  }

  @UseGuards(AuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(@SessionUser() user: AuthUser, @UploadedFile() file: AvatarUpload) {
    return this.profile.uploadAvatar(user.id, file);
  }

  @UseGuards(AuthGuard)
  @Delete('avatar')
  removeAvatar(@SessionUser() user: AuthUser) {
    return this.profile.removeAvatar(user.id);
  }

  @Get('avatar/:key')
  async avatar(@Param('key') key: string, @Res({ passthrough: true }) response: Response) {
    const object = await this.profile.avatar(key);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Type', object.contentType ?? 'image/webp');
    if (object.size != null) response.setHeader('Content-Length', object.size);
    return new StreamableFile(object.body);
  }

  @UseGuards(AuthGuard)
  @Post('password/set')
  async setPassword(@Headers() headers: Request['headers'], @Body() body: SetPasswordDto) {
    const auth = await getAuth(this.config);
    return auth.api.setPassword({ body: { newPassword: body.newPassword }, headers: this.toHeaders(headers) });
  }

  @UseGuards(AuthGuard)
  @Delete('account')
  async deleteAccount(@SessionUser() user: AuthUser, @Headers() headers: Request['headers'], @Body() body: DeleteAccountDto) {
    if (body.confirmation !== 'DELETE') throw new BadRequestException('Type DELETE to confirm account removal');
    const auth = await getAuth(this.config);
    const session = await auth.api.getSession({ headers: this.toHeaders(headers) });
    if (!session) throw new BadRequestException('Sign in again to delete this account');
    const profile = await this.profile.read(user.id);
    if (profile.hasPassword) {
      if (!body.password) throw new BadRequestException('Enter your current password to delete this account');
      await auth.api.verifyPassword({ body: { password: body.password }, headers: this.toHeaders(headers) });
    } else if (Date.now() - session.session.createdAt.getTime() > 10 * 60_000) {
      throw new BadRequestException('Sign in again within 10 minutes before deleting this account');
    }
    return this.deletion.request(user.id);
  }

  private toHeaders(headers: Request['headers']): Headers {
    const out = new globalThis.Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) value.forEach((entry) => out.append(key, entry));
      else if (value != null) out.set(key, String(value));
    }
    return out;
  }
}
