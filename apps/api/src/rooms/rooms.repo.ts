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

  // Generate a Meet-style Room Code, e.g. "abz-mnpq-rfk". Lowercase letters only,
  // omitting l/o to avoid 1/0 confusion when read aloud or typed.
  private roomCode(): string {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz';
    const group = (n: number): string => {
      const bytes = randomBytes(n);
      let out = '';
      for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
      return out;
    };
    return `${group(3)}-${group(4)}-${group(3)}`;
  }

  // Create a room owned by hostUserId with a freshly generated, unique Room Code.
  // Rooms have no title; the slug is always generated (never client-supplied).
  async create(params: { scheduledStart?: Date | null; hostUserId: string }): Promise<Room> {
    // Retry on the (astronomically unlikely) unique-constraint collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.room.create({
          data: {
            slug: this.roomCode(),
            scheduledStart: params.scheduledStart ?? null,
            hostKey: randomBytes(24).toString('base64url'),
            hostUserId: params.hostUserId,
          },
        });
      } catch (err: unknown) {
        if (this.isUniqueViolation(err)) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate a unique room code');
  }

  findBySlug(slug: string): Promise<Room | null> {
    return this.prisma.room.findUnique({ where: { slug } });
  }

  // The host's UPCOMING scheduled meetings only: those with a future start time.
  // Instant meetings (no scheduledStart) and past ones are intentionally omitted
  // — the lobby list exists solely to get back into a not-yet-started meeting.
  listByHost(hostUserId: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { hostUserId, scheduledStart: { gt: new Date() } },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }
}
