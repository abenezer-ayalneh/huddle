import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CloudStorageConnection, Recording } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService, DriveApiError } from './google-drive.service';
import { RecordingNoticeService } from './recording-notice.service';
import { SecretCryptoService } from './secret-crypto.service';
import { StorageConnectionsService, DriveAuthorizationError } from './storage-connections.service';
import { StorageService } from './storage.service';

const RETRY_MINUTES = [1, 5, 15, 60, 180] as const;
const LEASE_MS = 2 * 60 * 1000;

@Injectable()
export class RecordingDeliveryService {
  private readonly logger = new Logger(RecordingDeliveryService.name);
  private readonly owner = `recording-worker-${randomUUID()}`;
  private readonly localRetentionHours: number;
  private readonly deliveredRetentionHours: number;
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: StorageConnectionsService,
    private readonly drive: GoogleDriveService,
    private readonly storage: StorageService,
    private readonly crypto: SecretCryptoService,
    private readonly notices: RecordingNoticeService,
    config: ConfigService,
  ) {
    this.localRetentionHours = this.readHours(config, 'RECORDING_LOCAL_RETENTION_HOURS', 168);
    this.deliveredRetentionHours = this.readHours(config, 'RECORDING_DELIVERED_RETENTION_HOURS', 24);
    if (this.deliveredRetentionHours > this.localRetentionHours) {
      throw new Error('RECORDING_DELIVERED_RETENTION_HOURS cannot exceed RECORDING_LOCAL_RETENTION_HOURS');
    }
  }

  async onRecordingCompleted(recordingId: string, hostUserId: string): Promise<void> {
    const now = new Date();
    const hardDeadline = new Date(now.getTime() + this.localRetentionHours * 60 * 60 * 1000);
    await this.prisma.recording.updateMany({
      // Replayed Egress completion webhooks must never extend the shortened
      // post-delivery safety window back to the seven-day hard deadline.
      where: { id: recordingId, localExpiresAt: null },
      data: { localExpiresAt: hardDeadline, localDeleteAfter: hardDeadline },
    });
    const connection = await this.connections.activeConnection(hostUserId);
    if (!connection) return;
    await this.prisma.recordingDelivery.upsert({
      where: { recordingId },
      create: { recordingId, provider: 'google_drive', status: 'queued', nextAttemptAt: now },
      update: {},
    });
  }

  async queueBackfill(hostUserId: string): Promise<{ queued: number }> {
    const connection = await this.connections.activeConnection(hostUserId);
    if (!connection) return { queued: 0 };
    const claimed = await this.prisma.cloudStorageConnection.updateMany({
      where: { id: connection.id, backfillRequestedAt: null, status: 'connected' },
      data: { backfillRequestedAt: new Date() },
    });
    if (claimed.count !== 1) return { queued: 0 };
    const now = new Date();
    const retained = await this.prisma.recording.findMany({
      where: {
        status: 'completed',
        localDeletedAt: null,
        localDeleteAfter: { gt: now },
        room: { hostUserId },
      },
      select: { id: true, delivery: { select: { status: true } } },
    });
    const queueable = retained.filter((recording) => recording.delivery?.status !== 'delivered');
    await Promise.all(
      queueable.map((recording) =>
        this.prisma.recordingDelivery.upsert({
          where: { recordingId: recording.id },
          create: { recordingId: recording.id, provider: 'google_drive', status: 'queued', nextAttemptAt: now },
          update: { status: 'queued', nextAttemptAt: now, lastError: null },
        }),
      ),
    );
    return { queued: queueable.length };
  }

  // Reconnecting the same destination resumes failures automatically. The
  // separate backfill button is only for recordings that had no delivery job
  // while Drive was disconnected.
  async resumeActionRequired(hostUserId: string): Promise<void> {
    await this.prisma.recordingDelivery.updateMany({
      where: { status: 'action_required', recording: { room: { hostUserId }, localDeletedAt: null } },
      data: { status: 'queued', nextAttemptAt: new Date(), lastError: null, actionNotifiedAt: null },
    });
  }

  // Runs once in the dedicated single-concurrency process. It is intentionally
  // bounded: the next poll handles the next job, while lease fields make a
  // restart or a second accidentally-started worker safe.
  async runCycle(): Promise<void> {
    await this.initializeExistingGrace();
    await this.sendFinalExpiryReminders();
    await this.deleteExpiredLocalCopies();
    const delivery = await this.claimNextDelivery();
    if (delivery) await this.deliver(delivery.id);
  }

  async retentionPreview(): Promise<{ affectedObjects: number; bytes: number; localRetentionHours: number }> {
    const aggregate = await this.prisma.recording.aggregate({
      where: { status: 'completed', localDeletedAt: null },
      _count: { id: true },
      _sum: { sizeBytes: true },
    });
    return {
      affectedObjects: aggregate._count.id,
      bytes: Number(aggregate._sum.sizeBytes ?? 0n),
      localRetentionHours: this.localRetentionHours,
    };
  }

  private async initializeExistingGrace(): Promise<void> {
    if (this.initialized) return;
    const deadline = new Date(Date.now() + this.localRetentionHours * 60 * 60 * 1000);
    await this.prisma.recording.updateMany({
      where: { status: 'completed', localExpiresAt: null, localDeletedAt: null },
      data: { localExpiresAt: deadline, localDeleteAfter: deadline },
    });
    this.initialized = true;
  }

  private async claimNextDelivery(): Promise<{ id: string } | null> {
    const now = new Date();
    const candidate = await this.prisma.recordingDelivery.findFirst({
      where: {
        status: { in: ['queued', 'uploading'] },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        recording: { localDeletedAt: null },
      },
      orderBy: { nextAttemptAt: 'asc' },
      select: { id: true },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.recordingDelivery.updateMany({
      where: {
        id: candidate.id,
        status: { in: ['queued', 'uploading'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { status: 'uploading', leaseOwner: this.owner, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    });
    return claimed.count === 1 ? candidate : null;
  }

  private async deliver(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.recordingDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        recording: {
          include: {
            room: { include: { host: { select: { id: true, email: true } } } },
            recipients: true,
          },
        },
      },
    });
    if (!delivery || delivery.leaseOwner !== this.owner || delivery.recording.localDeletedAt) return;
    const connection = await this.connections.activeConnection(delivery.recording.room.hostUserId);
    if (!connection) {
      await this.actionRequired(delivery.id, delivery.recording.room.host.email, 'Google Drive is disconnected');
      return;
    }

    try {
      const accessToken = await this.connections.refreshAccessToken(connection);
      const existing = await this.drive.findVerifiedExisting(delivery.recording, accessToken);
      const file = existing ?? (await this.uploadDelivery(delivery, connection, accessToken));
      const verified = await this.drive.verify(delivery.recording, file.id!, accessToken);
      const deliveredAt = new Date();
      const retainedUntil = new Date(deliveredAt.getTime() + this.deliveredRetentionHours * 60 * 60 * 1000);
      const localDeleteAfter =
        delivery.recording.localExpiresAt && delivery.recording.localExpiresAt < retainedUntil ? delivery.recording.localExpiresAt : retainedUntil;
      await this.prisma.$transaction([
        this.prisma.recordingDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'delivered',
            driveFileId: verified.id,
            driveUrl: verified.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(verified.id!)}`,
            deliveredAt,
            lastError: null,
            encryptedUploadSession: null,
            leaseOwner: null,
            leaseUntil: null,
          },
        }),
        this.prisma.recording.update({ where: { id: delivery.recording.id }, data: { localDeleteAfter } }),
      ]);
      await this.shareRecipients(delivery.recording.id, verified.id!, accessToken);
    } catch (error) {
      await this.handleDeliveryError(delivery, connection.id, error);
    }
  }

  private async uploadDelivery(
    delivery: {
      id: string;
      encryptedUploadSession: string | null;
      uploadOffsetBytes: bigint;
      recording: Recording;
    },
    connection: CloudStorageConnection,
    accessToken: string,
  ) {
    const folder = await this.drive.ensureFolder(connection, accessToken);
    return this.drive.upload({
      recording: delivery.recording,
      folderId: folder.id,
      accessToken,
      sessionUrl: delivery.encryptedUploadSession ? this.crypto.decrypt(delivery.encryptedUploadSession) : null,
      offset: Number(delivery.uploadOffsetBytes),
      onSession: async (url, offset) => {
        await this.prisma.recordingDelivery.updateMany({
          where: { id: delivery.id, leaseOwner: this.owner },
          data: {
            encryptedUploadSession: url ? this.crypto.encrypt(url) : null,
            uploadOffsetBytes: BigInt(offset),
            leaseUntil: new Date(Date.now() + LEASE_MS),
          },
        });
      },
      heartbeat: () => this.heartbeat(delivery.id),
    });
  }

  private async heartbeat(id: string): Promise<void> {
    await this.prisma.recordingDelivery.updateMany({
      where: { id, leaseOwner: this.owner },
      data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
    });
  }

  private async shareRecipients(recordingId: string, driveFileId: string, accessToken: string): Promise<void> {
    const recipients = await this.prisma.recordingRecipient.findMany({ where: { recordingId, status: 'pending' } });
    for (const recipient of recipients) {
      try {
        const permissionId = await this.drive.shareReader(driveFileId, recipient.email, accessToken);
        await this.prisma.recordingRecipient.update({ where: { id: recipient.id }, data: { status: 'shared', permissionId, error: null } });
      } catch (error) {
        // A participant's Google policy/email failure is visible to the Host but
        // never holds a delivered MP4 on the VPS past the safety retention.
        await this.prisma.recordingRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', error: this.sanitizeError(error) },
        });
      }
    }
  }

  private async handleDeliveryError(
    delivery: { id: string; attempts: number; recording: { room: { host: { email: string } } } },
    connectionId: string,
    error: unknown,
  ): Promise<void> {
    if (error instanceof DriveAuthorizationError || this.requiresAction(error)) {
      await this.connections.markActionRequired(connectionId);
      await this.actionRequired(delivery.id, delivery.recording.room.host.email, this.sanitizeError(error));
      return;
    }
    const attempts = delivery.attempts + 1;
    const minutes = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)] ?? 360;
    const delay = attempts > RETRY_MINUTES.length ? 360 : minutes;
    await this.prisma.recordingDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'queued',
        attempts,
        nextAttemptAt: new Date(Date.now() + delay * 60 * 1000),
        lastError: this.sanitizeError(error),
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    this.logger.warn(`Recording Drive delivery will retry in ${delay} minutes`);
  }

  private async actionRequired(deliveryId: string, hostEmail: string, reason: string): Promise<void> {
    const current = await this.prisma.recordingDelivery.findUnique({ where: { id: deliveryId }, select: { actionNotifiedAt: true } });
    await this.prisma.recordingDelivery.update({
      where: { id: deliveryId },
      data: { status: 'action_required', lastError: reason, leaseOwner: null, leaseUntil: null },
    });
    if (!current?.actionNotifiedAt) {
      await this.notices.actionRequired(hostEmail);
      await this.prisma.recordingDelivery.update({ where: { id: deliveryId }, data: { actionNotifiedAt: new Date() } });
    }
  }

  private async sendFinalExpiryReminders(): Promise<void> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const recordings = await this.prisma.recording.findMany({
      where: {
        status: 'completed',
        localDeletedAt: null,
        finalWarningSentAt: null,
        localExpiresAt: { gt: now, lte: in24Hours },
        OR: [{ delivery: null }, { delivery: { status: { not: 'delivered' } } }],
      },
      include: { room: { include: { host: { select: { email: true } } } } },
    });
    for (const recording of recordings) {
      await this.notices.expiryReminder(recording.room.host.email);
      await this.prisma.recording.update({ where: { id: recording.id }, data: { finalWarningSentAt: new Date() } });
    }
  }

  private async deleteExpiredLocalCopies(): Promise<void> {
    const due = await this.prisma.recording.findMany({
      where: { status: 'completed', localDeletedAt: null, localDeleteAfter: { lte: new Date() } },
      include: { delivery: true },
      take: 10,
    });
    for (const recording of due) {
      try {
        await this.storage.deleteObject(recording.objectKey);
        await this.prisma.$transaction([
          this.prisma.recording.update({ where: { id: recording.id }, data: { localDeletedAt: new Date() } }),
          ...(recording.delivery && recording.delivery.status !== 'delivered'
            ? [
                this.prisma.recordingDelivery.update({
                  where: { id: recording.delivery.id },
                  data: { status: 'expired_undelivered', leaseOwner: null, leaseUntil: null },
                }),
              ]
            : []),
        ]);
      } catch (error) {
        this.logger.warn(`Recording local deletion will retry: ${this.sanitizeError(error)}`);
      }
    }
  }

  private requiresAction(error: unknown): boolean {
    return (
      error instanceof DriveApiError && (error.reason === 'storageQuotaExceeded' || error.reason === 'dailyLimitExceeded' || error.reason === 'domainPolicy')
    );
  }

  private sanitizeError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.replace(/https?:\/\/\S+/g, '[redacted]').slice(0, 240);
  }

  private readHours(config: ConfigService, name: string, fallback: number): number {
    const value = Number(config.get<string>(name) ?? fallback);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive whole number of hours`);
    return value;
  }
}
