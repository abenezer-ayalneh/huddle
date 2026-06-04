import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EgressInfo } from 'livekit-server-sdk';
import { EgressStatus } from 'livekit-server-sdk';
import type { Readable } from 'node:stream';
import { EgressService } from './egress.service';
import { RecordingRepository } from './recordings.repo';
import { RoomRepository } from './rooms.repo';
import { StorageService } from './storage.service';

export interface RecordingSummary {
  id: string;
  status: string;
  filename: string;
  sizeBytes: number | null;
  durationMs: number | null;
  startedAt: string;
  endedAt: string | null;
  error: string | null;
  // True when the file is finished and can be downloaded.
  downloadable: boolean;
}

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    private readonly rooms: RoomRepository,
    private readonly recordings: RecordingRepository,
    private readonly egress: EgressService,
    private readonly storage: StorageService,
  ) {}

  // Host starts a room-composite recording. One active recording per room.
  async start(slug: string): Promise<RecordingSummary> {
    const room = await this.requireRoom(slug);
    const active = await this.recordings.listActiveByRoom(room.id);
    if (active.length > 0) {
      throw new ConflictException('A recording is already in progress');
    }
    await this.storage.ensureBucket();

    const objectKey = `${slug}/${this.timestamp()}.mp4`;
    const { egressId } = await this.egress.startRoomComposite(slug, objectKey);
    const rec = await this.recordings.create({
      egressId,
      roomId: room.id,
      objectKey,
    });
    return this.toSummary(rec);
  }

  // Host stops a specific recording. Idempotent-ish: the egress webhook will
  // finalise status; we just ask egress to wrap up.
  async stop(slug: string, recordingId: string): Promise<RecordingSummary> {
    const { rec } = await this.requireRecording(slug, recordingId);
    try {
      await this.egress.stop(rec.egressId);
    } catch (err) {
      // Already stopping/stopped — let the webhook reconcile the final state.
      this.logger.warn(`stopEgress(${rec.egressId}) failed: ${String(err)}`);
    }
    const fresh = await this.recordings.findByEgressId(rec.egressId);
    return this.toSummary(fresh ?? rec);
  }

  async list(slug: string): Promise<{ recordings: RecordingSummary[] }> {
    const room = await this.requireRoom(slug);
    const rows = await this.recordings.listByRoom(room.id);
    return { recordings: rows.map((r) => this.toSummary(r)) };
  }

  // Stream a finished recording back to the host for download.
  async download(
    slug: string,
    recordingId: string,
  ): Promise<{ body: Readable; size?: number; filename: string }> {
    const { rec } = await this.requireRecording(slug, recordingId);
    if (rec.status !== 'completed') {
      throw new ConflictException('Recording is not ready yet');
    }
    const { body, size } = await this.storage.getObject(rec.objectKey);
    return { body, size, filename: this.basename(rec.objectKey) };
  }

  // Advance a recording's lifecycle from a verified egress webhook event.
  async handleEgressEvent(info: EgressInfo): Promise<void> {
    const rec = await this.recordings.findByEgressId(info.egressId);
    if (!rec) return; // Not one of ours (or already pruned).

    const status = this.mapStatus(info.status);
    const file = info.fileResults?.[0];
    const ended =
      status === 'completed' || status === 'failed' || status === 'aborted';

    await this.recordings.updateByEgressId(info.egressId, {
      status,
      ...(file?.size != null ? { sizeBytes: file.size } : {}),
      ...(file?.duration != null
        ? { durationMs: Math.round(Number(file.duration) / 1_000_000) }
        : {}),
      ...(info.error ? { error: info.error } : {}),
      ...(ended ? { endedAt: new Date() } : {}),
    });
  }

  private mapStatus(status: EgressStatus): string {
    switch (status) {
      case EgressStatus.EGRESS_STARTING:
        return 'starting';
      case EgressStatus.EGRESS_ACTIVE:
      case EgressStatus.EGRESS_ENDING:
        return 'active';
      case EgressStatus.EGRESS_COMPLETE:
        return 'completed';
      case EgressStatus.EGRESS_ABORTED:
        return 'aborted';
      default:
        return 'failed';
    }
  }

  private async requireRoom(slug: string) {
    const room = await this.rooms.findBySlug(slug);
    if (!room) throw new NotFoundException('No such room');
    return room;
  }

  private async requireRecording(slug: string, recordingId: string) {
    const room = await this.requireRoom(slug);
    const rec = await this.recordings.findById(recordingId);
    if (!rec || rec.roomId !== room.id) {
      throw new NotFoundException('No such recording for this room');
    }
    return { room, rec };
  }

  private toSummary(rec: {
    id: string;
    status: string;
    objectKey: string;
    sizeBytes: bigint | null;
    durationMs: number | null;
    startedAt: Date;
    endedAt: Date | null;
    error: string | null;
  }): RecordingSummary {
    return {
      id: rec.id,
      status: rec.status,
      filename: this.basename(rec.objectKey),
      sizeBytes: rec.sizeBytes != null ? Number(rec.sizeBytes) : null,
      durationMs: rec.durationMs,
      startedAt: rec.startedAt.toISOString(),
      endedAt: rec.endedAt?.toISOString() ?? null,
      error: rec.error,
      downloadable: rec.status === 'completed',
    };
  }

  private basename(key: string): string {
    return key.split('/').pop() || key;
  }

  // Compact, filesystem-safe UTC timestamp for the object key.
  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
