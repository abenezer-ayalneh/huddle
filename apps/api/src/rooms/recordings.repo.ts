import { Injectable } from '@nestjs/common';
import type { Recording } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// DB store for recordings (Phase 8). One row per egress job; the lifecycle is
// advanced by the egress webhook handler.
@Injectable()
export class RecordingRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(params: {
    egressId: string;
    roomId: string;
    objectKey: string;
    startedByIdentity?: string | null;
    driveShareAvailable?: boolean;
  }): Promise<Recording> {
    return this.prisma.recording.create({
      data: {
        egressId: params.egressId,
        roomId: params.roomId,
        objectKey: params.objectKey,
        startedByIdentity: params.startedByIdentity ?? null,
        driveShareAvailable: params.driveShareAvailable ?? false,
        status: 'starting',
      },
    });
  }

  findByEgressId(egressId: string): Promise<Recording | null> {
    return this.prisma.recording.findUnique({ where: { egressId } });
  }

  findById(id: string): Promise<Recording | null> {
    return this.prisma.recording.findUnique({ where: { id } });
  }

  listByRoom(roomId: string) {
    return this.prisma.recording.findMany({
      where: { roomId },
      orderBy: { startedAt: 'desc' },
      include: { delivery: true, recipients: true },
    });
  }

  // Every recording across all rooms owned by a host, each joined to its room's
  // code (slug) and host key — backs the lobby's cross-room /recordings view.
  listByHostUser(hostUserId: string) {
    return this.prisma.recording.findMany({
      where: { room: { hostUserId } },
      orderBy: { startedAt: 'desc' },
      include: {
        room: { select: { slug: true, hostKey: true } },
        delivery: true,
        recipients: true,
      },
    });
  }

  // Any recording for this room still being captured (used to stop on demand
  // and to reflect "recording in progress" to the host UI).
  listActiveByRoom(roomId: string): Promise<Recording[]> {
    return this.prisma.recording.findMany({
      where: { roomId, status: { in: ['starting', 'active'] } },
    });
  }

  updateByEgressId(
    egressId: string,
    data: Partial<Pick<Recording, 'status' | 'objectKey' | 'sizeBytes' | 'durationMs' | 'error' | 'endedAt'>>,
  ): Promise<Recording> {
    return this.prisma.recording.update({ where: { egressId }, data });
  }

  async upsertRecipient(params: { recordingId: string; userId: string; email: string; name?: string | null; consentedAt: Date }): Promise<void> {
    await this.prisma.recordingRecipient.upsert({
      where: { recordingId_userId: { recordingId: params.recordingId, userId: params.userId } },
      create: {
        recordingId: params.recordingId,
        userId: params.userId,
        email: params.email,
        name: params.name ?? null,
        consentedAt: params.consentedAt,
      },
      update: {},
    });
  }

  async getUser(userId: string): Promise<{ id: string; email: string; name: string } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  }

  async findActiveByRoom(roomId: string) {
    return this.prisma.recording.findFirst({
      where: { roomId, status: { in: ['starting', 'active'] } },
      orderBy: { startedAt: 'desc' },
      include: { delivery: true, recipients: true },
    });
  }
}
