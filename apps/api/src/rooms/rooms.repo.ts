import { Injectable } from '@nestjs/common';
import type { Room } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// DB-backed store for managed rooms. Rooms now persist (survive an API
// restart) and belong to a signed-in host, so this replaces the old in-memory
// room map. Waiting-room knocks remain ephemeral (see rooms.state.ts).
@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Slugify a title for use as a URL-safe, LiveKit-safe room name.
  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'room'
    );
  }

  // Create a room owned by hostUserId. If `slug` is taken (or derived from the
  // title collides), append a short random suffix until it's unique.
  async create(params: {
    title: string;
    slug?: string;
    scheduledStart?: Date | null;
    hostUserId: string;
  }): Promise<Room> {
    const base = this.slugify(params.slug ?? params.title);
    let slug = base;
    // Retry on unique-constraint collision rather than racing a pre-check.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.room.create({
          data: {
            slug,
            title: params.title,
            scheduledStart: params.scheduledStart ?? null,
            hostKey: randomBytes(24).toString('base64url'),
            hostUserId: params.hostUserId,
          },
        });
      } catch (err: unknown) {
        if (this.isUniqueViolation(err)) {
          slug = `${base}-${randomBytes(2).toString('hex')}`;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Could not allocate a unique room slug');
  }

  findBySlug(slug: string): Promise<Room | null> {
    return this.prisma.room.findUnique({ where: { slug } });
  }

  listByHost(hostUserId: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { hostUserId },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002'
    );
  }
}
