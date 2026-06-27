import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { EgressInfo } from 'livekit-server-sdk';
import { EgressStatus } from 'livekit-server-sdk';
import type { Readable } from 'node:stream';
import { FaultCode, faultBody } from '../common/faults';
import { DownloadTokenService } from './download-token.service';
import { EgressService } from './egress.service';
import { LivekitService } from './livekit.service';
import type { CallParticipant } from './participant.guard';
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
  // Short-lived signed token authorizing a native browser download of this exact
  // recording (docs/adr/0022); null until the recording is `completed`. The
  // client builds the download URL from it — no `x-host-key` header needed.
  downloadToken: string | null;
}

// A recording listed across rooms (lobby /recordings view): adds the owning Room
// Code. The download is authorized by the per-recording `downloadToken`, so no
// host key travels in this response.
export interface MyRecordingSummary extends RecordingSummary {
  room: string;
}

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    private readonly rooms: RoomRepository,
    private readonly recordings: RecordingRepository,
    private readonly egress: EgressService,
    private readonly storage: StorageService,
    private readonly livekit: LivekitService,
    private readonly downloadTokens: DownloadTokenService,
  ) {}

  // Host starts a room-composite recording. One active recording per room.
  async start(slug: string): Promise<RecordingSummary> {
    return this.startRecording(slug, null);
  }

  // The host approves a participant's Request to Record (docs/adr/0011), which
  // starts the recording immediately, attributed to that participant so they
  // can later stop it. Host-key authorized via the controller — there is no
  // standing grant; approval *is* the start.
  async startForParticipant(slug: string, identity: string): Promise<RecordingSummary> {
    return this.startRecording(slug, identity);
  }

  private async startRecording(slug: string, startedByIdentity: string | null): Promise<RecordingSummary> {
    const room = await this.requireRoom(slug);
    const active = await this.recordings.listActiveByRoom(room.id);
    if (active.length > 0) {
      throw new ConflictException(faultBody(FaultCode.RECORDING_IN_PROGRESS, 'A recording is already in progress'));
    }
    // The store must be reachable AND accept our credentials before we ask
    // egress to record — otherwise egress runs and the upload silently fails,
    // leaving the recording `failed` with no signal to the host. Fail loudly here.
    try {
      await this.storage.ensureBucket();
    } catch (err) {
      this.logger.error(`Recording storage unavailable for room "${slug}": ${String(err)}`);
      throw new ServiceUnavailableException(faultBody(FaultCode.UPSTREAM_UNAVAILABLE, 'Recording storage is unavailable — recording was not started.'));
    }

    const objectKey = `${slug}/${this.timestamp()}.mp4`;
    const { egressId } = await this.egress.startRoomComposite(slug, objectKey);
    const rec = await this.recordings.create({
      egressId,
      roomId: room.id,
      objectKey,
      startedByIdentity,
    });
    // Light up the room-wide Recording Indicator immediately; the egress webhook
    // will clear it when the recording actually ends.
    await this.setIndicator(slug, true);
    return this.toSummary(rec, slug);
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
    return this.toSummary(fresh ?? rec, slug);
  }

  // A non-host participant stops the active recording they started. Authority
  // comes from the recording's `startedByIdentity`, not a grant (the grant was
  // spent at start). The host's own stop goes through the host-key `stop` above.
  async stopAsParticipant(slug: string, participant: CallParticipant): Promise<RecordingSummary> {
    const room = await this.requireRoom(slug);
    const active = await this.recordings.listActiveByRoom(room.id);
    const mine = active.find((r) => r.startedByIdentity === participant.identity);
    if (!mine) {
      throw new ForbiddenException(faultBody(FaultCode.NOT_RECORDING_OWNER, 'You have no active recording to stop'));
    }
    return this.stop(slug, mine.id);
  }

  async list(slug: string): Promise<{ recordings: RecordingSummary[] }> {
    const room = await this.requireRoom(slug);
    const rows = await this.recordings.listByRoom(room.id);
    return { recordings: rows.map((r) => this.toSummary(r, slug)) };
  }

  // Every recording across all rooms a signed-in host owns. Each carries its Room
  // Code and host key so the lobby's /recordings view can download via the
  // existing host-key endpoint (the owner is entitled to their own host keys).
  async listMine(hostUserId: string): Promise<{ recordings: MyRecordingSummary[] }> {
    const rows = await this.recordings.listByHostUser(hostUserId);
    return {
      recordings: rows.map((r) => ({
        ...this.toSummary(r, r.room.slug),
        room: r.room.slug,
      })),
    };
  }

  // Stream a finished recording back to the host for download.
  async download(slug: string, recordingId: string): Promise<{ body: Readable; size?: number; filename: string }> {
    const { rec } = await this.requireRecording(slug, recordingId);
    if (rec.status !== 'completed') {
      throw new ConflictException(faultBody(FaultCode.RECORDING_NOT_READY, 'Recording is not ready yet'));
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
    const ended = status === 'completed' || status === 'failed' || status === 'aborted';

    await this.recordings.updateByEgressId(info.egressId, {
      status,
      ...(file?.size != null ? { sizeBytes: file.size } : {}),
      ...(file?.duration != null ? { durationMs: Math.round(Number(file.duration) / 1_000_000) } : {}),
      ...(info.error ? { error: info.error } : {}),
      ...(ended ? { endedAt: new Date() } : {}),
    });

    // Keep the room-wide Recording Indicator in sync. On end, only clear it once
    // no recording is still running (defensive — there is one at a time today).
    if (info.roomName) {
      if (ended) {
        const stillActive = await this.recordings.listActiveByRoom(rec.roomId);
        if (stillActive.length === 0) await this.setIndicator(info.roomName, false);
      } else {
        await this.setIndicator(info.roomName, true);
      }
    }
  }

  // Best-effort: a failed metadata write must not fail the recording action or
  // the webhook. The indicator is a convenience signal, not the source of truth.
  private async setIndicator(slug: string, active: boolean): Promise<void> {
    try {
      await this.livekit.setRecordingActive(slug, active);
    } catch (err) {
      this.logger.warn(`setRecordingActive(${slug}, ${active}) failed: ${String(err)}`);
    }
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
    if (!room) throw new NotFoundException(faultBody(FaultCode.ROOM_NOT_FOUND, 'No such room'));
    return room;
  }

  private async requireRecording(slug: string, recordingId: string) {
    const room = await this.requireRoom(slug);
    const rec = await this.recordings.findById(recordingId);
    if (!rec || rec.roomId !== room.id) {
      throw new NotFoundException(faultBody(FaultCode.RECORDING_NOT_FOUND, 'No such recording for this room'));
    }
    return { room, rec };
  }

  // `slug` is the recording's Room Code — needed to bind the download token to
  // this exact room + recording (docs/adr/0022). Every caller has it in scope.
  private toSummary(
    rec: {
      id: string;
      status: string;
      objectKey: string;
      sizeBytes: bigint | null;
      durationMs: number | null;
      startedAt: Date;
      endedAt: Date | null;
      error: string | null;
    },
    slug: string,
  ): RecordingSummary {
    const downloadable = rec.status === 'completed';
    return {
      id: rec.id,
      status: rec.status,
      filename: this.basename(rec.objectKey),
      sizeBytes: rec.sizeBytes != null ? Number(rec.sizeBytes) : null,
      durationMs: rec.durationMs,
      startedAt: rec.startedAt.toISOString(),
      endedAt: rec.endedAt?.toISOString() ?? null,
      error: rec.error,
      downloadable,
      // Only a finished file is downloadable; no point minting a token otherwise.
      downloadToken: downloadable ? this.downloadTokens.sign(slug, rec.id) : null,
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
