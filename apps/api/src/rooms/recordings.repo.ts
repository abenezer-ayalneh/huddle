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
  }): Promise<Recording> {
    return this.prisma.recording.create({
      data: {
        egressId: params.egressId,
        roomId: params.roomId,
        objectKey: params.objectKey,
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

  listByRoom(roomId: string): Promise<Recording[]> {
    return this.prisma.recording.findMany({
      where: { roomId },
      orderBy: { startedAt: 'desc' },
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
    data: Partial<
      Pick<
        Recording,
        | 'status'
        | 'objectKey'
        | 'sizeBytes'
        | 'durationMs'
        | 'error'
        | 'endedAt'
      >
    >,
  ): Promise<Recording> {
    return this.prisma.recording.update({ where: { egressId }, data });
  }
}
