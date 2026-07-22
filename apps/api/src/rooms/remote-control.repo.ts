import { Injectable } from '@nestjs/common';
import type { RemoteControlSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RemoteControlSessionWithRoom = RemoteControlSession & {
  room: { slug: string };
};

// Metadata-only audit persistence for attended Remote Control. Redis remains the
// live authority; conditional updates here keep duplicate/replayed lifecycle
// calls idempotent and preserve an honest history.
@Injectable()
export class RemoteControlRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRequest(params: {
    roomId: string;
    sharerIdentity: string;
    sharerName: string;
    controllerIdentity: string;
    controllerName: string;
  }): Promise<RemoteControlSession> {
    return this.prisma.remoteControlSession.create({
      data: {
        roomId: params.roomId,
        sharerIdentity: params.sharerIdentity,
        sharerName: params.sharerName,
        controllerIdentity: params.controllerIdentity,
        controllerName: params.controllerName,
        status: 'requested',
      },
    });
  }

  findById(id: string): Promise<RemoteControlSession | null> {
    return this.prisma.remoteControlSession.findUnique({ where: { id } });
  }

  findActiveByRoom(roomId: string): Promise<RemoteControlSession | null> {
    return this.prisma.remoteControlSession.findFirst({
      where: { roomId, status: 'active' },
    });
  }

  async activate(id: string, params: { agentIdentity: string; startedAt: Date; renewalDueAt: Date }): Promise<RemoteControlSession | null> {
    const result = await this.prisma.remoteControlSession.updateMany({
      where: { id, status: 'requested' },
      data: {
        status: 'active',
        agentIdentity: params.agentIdentity,
        startedAt: params.startedAt,
        renewalDueAt: params.renewalDueAt,
      },
    });
    return result.count === 1 ? this.findById(id) : null;
  }

  async deny(id: string, endedAt: Date): Promise<boolean> {
    return this.transitionRequested(id, 'denied', 'sharer_denied', endedAt);
  }

  async expireRequest(id: string, endedAt: Date): Promise<boolean> {
    return this.transitionRequested(id, 'expired', 'request_timeout', endedAt);
  }

  async failRequest(id: string, reason: string, endedAt: Date): Promise<boolean> {
    return this.transitionRequested(id, 'failed', reason, endedAt);
  }

  async updateRenewal(id: string, renewalDueAt: Date): Promise<boolean> {
    const result = await this.prisma.remoteControlSession.updateMany({
      where: { id, status: 'active' },
      data: { renewalDueAt },
    });
    return result.count === 1;
  }

  async endActive(id: string, status: 'ended' | 'expired' | 'failed', endReason: string, endedAt: Date): Promise<boolean> {
    const result = await this.prisma.remoteControlSession.updateMany({
      where: { id, status: 'active' },
      data: { status, endReason, endedAt },
    });
    return result.count === 1;
  }

  findDueActive(now: Date): Promise<RemoteControlSessionWithRoom[]> {
    return this.prisma.remoteControlSession.findMany({
      where: {
        status: 'active',
        renewalDueAt: { lte: now },
      },
      include: { room: { select: { slug: true } } },
    });
  }

  findExpiredRequests(cutoff: Date): Promise<RemoteControlSessionWithRoom[]> {
    return this.prisma.remoteControlSession.findMany({
      where: {
        status: 'requested',
        createdAt: { lte: cutoff },
      },
      include: { room: { select: { slug: true } } },
    });
  }

  private async transitionRequested(id: string, status: 'denied' | 'expired' | 'failed', endReason: string, endedAt: Date): Promise<boolean> {
    const result = await this.prisma.remoteControlSession.updateMany({
      where: { id, status: 'requested' },
      data: { status, endReason, endedAt },
    });
    return result.count === 1;
  }
}
