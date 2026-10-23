import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EgressService } from './egress.service';
import { LivekitService } from './livekit.service';
import { RemoteControlService } from './remote-control.service';
import { StorageConnectionsService } from './storage-connections.service';
import { StorageService } from './storage.service';
import { RoomStateService } from './rooms.state';

@Injectable()
export class AccountDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly egress: EgressService,
    private readonly remoteControl: RemoteControlService,
    private readonly storage: StorageService,
    private readonly connections: StorageConnectionsService,
    private readonly roomState: RoomStateService,
  ) {}

  onModuleInit() {
    void this.runCycle();
    this.timer = setInterval(() => void this.runCycle(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async request(userId: string) {
    await this.prisma.accountDeletion.upsert({
      where: { userId },
      create: { userId, status: 'pending' },
      update: { status: 'pending', lastError: null },
    });
    await this.prisma.session.deleteMany({ where: { userId } });
    return { accepted: true };
  }

  async runCycle() {
    if (this.busy) return;
    this.busy = true;
    let processingUserId: string | undefined;
    try {
      const now = new Date(Date.now() - 60_000);
      const job = await this.prisma.accountDeletion.findFirst({
        where: { OR: [{ status: 'pending' }, { status: 'processing', updatedAt: { lt: now } }] },
        orderBy: { createdAt: 'asc' },
      });
      if (!job) return;
      const claimed = await this.prisma.accountDeletion.updateMany({
        where: { userId: job.userId, OR: [{ status: 'pending' }, { status: 'processing', updatedAt: { lt: now } }] },
        data: { status: 'processing', attempts: { increment: 1 }, lastError: null },
      });
      if (claimed.count !== 1) return;
      processingUserId = job.userId;
      await this.cleanup(job.userId);
    } catch (error) {
      this.logger.error(`Account deletion cleanup failed: ${String(error)}`);
      if (processingUserId)
        await this.prisma.accountDeletion
          .updateMany({
            where: { userId: processingUserId, status: 'processing' },
            data: { status: 'pending', lastError: error instanceof Error ? error.message.slice(0, 500) : 'cleanup failed' },
          })
          .catch(() => undefined);
    } finally {
      this.busy = false;
    }
  }

  private async cleanup(userId: string) {
    const activeRooms = await this.livekit.listActiveRooms();
    await Promise.all(activeRooms.map((room) => this.removeKnocks(room.name, userId)));
    for (const room of activeRooms) {
      const participants = await this.livekit.listConnectedParticipants(room.name);
      for (const participant of participants) {
        if (this.livekit.matchesAccountBinding(userId, participant.accountBinding)) {
          await this.remoteControl.onParticipantLeft(room.name, participant.identity);
        }
      }
    }
    await this.livekit.removeAccountParticipants(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { image: true, rooms: { select: { id: true, slug: true, recordings: { select: { id: true, egressId: true, status: true, objectKey: true } } } } },
    });
    if (!user) {
      await this.prisma.accountDeletion.deleteMany({ where: { userId } });
      return;
    }

    const uploads = await this.prisma.recordingDelivery.findFirst({
      where: { status: 'uploading', leaseUntil: { gt: new Date() }, recording: { room: { hostUserId: userId } } },
      select: { id: true },
    });
    if (uploads) throw new Error('Waiting for an active Drive delivery to stop');

    for (const room of user.rooms) {
      await this.remoteControl.onRoomFinished(room.slug);
      for (const recording of room.recordings) {
        if (recording.status === 'starting' || recording.status === 'active') {
          await this.egress.stop(recording.egressId).catch((error: unknown) => {
            if (!/not found|not_found|does not exist/i.test(String(error))) throw error;
          });
        }
      }
      const activeRooms = await this.livekit.listActiveRooms();
      if (activeRooms.some((entry) => entry.name === room.slug)) await this.livekit.endRoom(room.slug);
    }

    await this.prisma.recordingDelivery.updateMany({
      where: { status: { in: ['queued', 'uploading', 'action_required'] }, recording: { room: { hostUserId: userId } } },
      data: { status: 'action_required', leaseOwner: null, leaseUntil: null, encryptedUploadSession: null, lastError: 'Account deletion in progress' },
    });
    for (const room of user.rooms) {
      for (const recording of room.recordings) await this.storage.deleteObject(recording.objectKey);
    }

    await this.connections.disconnectForAccountDeletion(userId);
    await this.deleteOwnedAvatar(user.image);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private async removeKnocks(room: string, userId: string) {
    // Knock state is scoped in Redis; a temporary outage leaves the durable
    // deletion job pending so it can retry before final record removal.
    await this.roomState.removePendingKnocksForUser(room, userId);
  }

  private async deleteOwnedAvatar(url: string | null) {
    if (!url) return;
    let key: string;
    let huddleAvatar = false;
    try {
      const parsed = new URL(url);
      key = decodeURIComponent(parsed.pathname.split('/profile/avatar/')[1] ?? '');
      huddleAvatar = parsed.pathname.includes('/profile/avatar/');
    } catch {
      // Google CDN pictures are not managed by Huddle.
      return;
    }
    if (huddleAvatar && /^[a-f0-9-]+\.webp$/.test(key)) await this.storage.deleteObject(`huddle-avatars/${key}`);
  }
}
