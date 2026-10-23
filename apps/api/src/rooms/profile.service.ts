import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LivekitService } from './livekit.service';
import { RoomStateService } from './rooms.state';
import { StorageService } from './storage.service';
import sharp from 'sharp';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_PREFIX = 'huddle-avatars/';
export interface AvatarUpload {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly roomState: RoomStateService,
    private readonly storage: StorageService,
  ) {}

  async read(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true, image: true, accounts: { select: { providerId: true, password: true } } },
    });
    if (!user) throw new NotFoundException('Account not found');
    return { ...user, hasPassword: user.accounts.some((account) => account.providerId === 'credential' && Boolean(account.password)), accounts: undefined };
  }

  async updateName(userId: string, name: string) {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) throw new BadRequestException('Display name must be between 1 and 80 characters');
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name: cleanName }, select: { id: true, name: true, image: true } });
    await this.sync(user.id, user.name, user.image);
    return user;
  }

  async uploadAvatar(userId: string, file: AvatarUpload) {
    if (!file?.buffer?.length || file.size > MAX_AVATAR_BYTES) throw new BadRequestException('Avatar must be an image no larger than 5 MiB');
    let image: Buffer;
    try {
      const decoded = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: 'error' });
      const metadata = await decoded.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) throw new Error('Unsupported format');
      image = await decoded.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 84 }).toBuffer();
    } catch {
      throw new BadRequestException('Choose a valid JPEG, PNG, or WebP image');
    }
    const key = `${AVATAR_PREFIX}${randomUUID()}.webp`;
    await this.storage.putObject(key, image, 'image/webp');
    const old = await this.prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
    const baseUrl = this.storage.publicApiUrl;
    const imageUrl = `${baseUrl}/profile/avatar/${encodeURIComponent(key.slice(AVATAR_PREFIX.length))}`;
    let user: { id: string; name: string; image: string | null };
    try {
      user = await this.prisma.user.update({ where: { id: userId }, data: { image: imageUrl }, select: { id: true, name: true, image: true } });
    } catch (error) {
      await this.storage.deleteObject(key).catch((cleanupError: unknown) => {
        this.logger.warn(`Could not clean up unused avatar ${key}: ${String(cleanupError)}`);
      });
      throw error;
    }
    await this.deleteOwnedAvatar(old?.image);
    await this.sync(user.id, user.name, user.image);
    return { image: user.image };
  }

  async removeAvatar(userId: string) {
    const previous = await this.prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { image: null }, select: { id: true, name: true, image: true } });
    await this.deleteOwnedAvatar(previous?.image);
    await this.sync(user.id, user.name, null);
    return { image: null };
  }

  async avatar(key: string) {
    if (!/^[a-f0-9-]+\.webp$/.test(key)) throw new NotFoundException();
    return this.storage.getObject(`${AVATAR_PREFIX}${key}`);
  }

  private async sync(userId: string, name: string, image: string | null) {
    // Save is authoritative even during a temporary SFU outage. Waiting-room
    // snapshots update independently, and clients see fresh data on next join.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rooms = await this.livekit.listActiveRooms();
        await Promise.all(rooms.map((room) => this.roomState.updatePendingKnocksForUser(room.name, userId, name, image)));
        await this.livekit.syncAccountProfile(userId, name, image);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    this.logger.warn(`Profile saved for ${userId}, but live meeting sync failed after retries: ${String(lastError)}`);
  }

  private async deleteOwnedAvatar(url?: string | null) {
    if (!url) return;
    let key: string;
    let isHuddleAvatar = false;
    try {
      const parsed = new URL(url);
      key = decodeURIComponent(parsed.pathname.split('/profile/avatar/')[1] ?? '');
      isHuddleAvatar = parsed.pathname.includes('/profile/avatar/') && /^[a-f0-9-]+\.webp$/.test(key);
    } catch {
      // Existing Google avatar URLs and malformed legacy values are external.
      return;
    }
    if (!isHuddleAvatar) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.storage.deleteObject(`${AVATAR_PREFIX}${key}`);
        return;
      } catch (error) {
        if (attempt === 2) {
          this.logger.warn(`Could not remove replaced avatar ${key}: ${String(error)}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
  }
}
