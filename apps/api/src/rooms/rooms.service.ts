import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Room } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { makeIdentity } from './identity';
import { LivekitService } from './livekit.service';
import { RoomRepository } from './rooms.repo';
import { Knock, RoomStateService } from './rooms.state';

export interface HostJoinResult {
  room: string;
  title: string;
  scheduledStart: string | null;
  identity: string;
  token: string;
  hostKey: string;
  livekitUrl: string;
}

export interface RoomSummary {
  room: string;
  title: string;
  scheduledStart: string | null;
  hostKey: string;
  createdAt: string;
}

export interface KnockStatusResult {
  status: Knock['status'];
  token?: string;
  identity?: string;
  livekitUrl?: string;
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly repo: RoomRepository,
    private readonly state: RoomStateService,
    private readonly livekit: LivekitService,
  ) {}

  // A signed-in host creates a (optionally scheduled) managed room and gets a
  // host token + host key so they can join right away.
  async createRoom(
    host: AuthUser,
    params: { title: string; slug?: string; scheduledStart?: string },
  ): Promise<HostJoinResult> {
    const scheduledStart = params.scheduledStart
      ? new Date(params.scheduledStart)
      : null;
    const room = await this.repo.create({
      title: params.title,
      slug: params.slug,
      scheduledStart,
      hostUserId: host.id,
    });
    return this.mintHostJoin(room, host.name);
  }

  // Owner rejoins their own room later (e.g. a scheduled meeting). Mints a
  // fresh host token; the host key is stable for the life of the room.
  async hostJoin(slug: string, host: AuthUser): Promise<HostJoinResult> {
    const room = await this.requireRoom(slug);
    if (room.hostUserId !== host.id) {
      throw new ForbiddenException('You are not the host of this room');
    }
    return this.mintHostJoin(room, host.name);
  }

  // Rooms the signed-in user hosts (with host keys, since they own them).
  async listMine(userId: string): Promise<{ rooms: RoomSummary[] }> {
    const rooms = await this.repo.listByHost(userId);
    return { rooms: rooms.map((r) => this.toSummary(r)) };
  }

  // Public info for a guest landing on a room link (does NOT leak the host key).
  async getPublic(slug: string): Promise<{
    room: string;
    title: string;
    scheduledStart: string | null;
  }> {
    const room = await this.requireRoom(slug);
    return {
      room: room.slug,
      title: room.title,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
    };
  }

  // Guest knocks; must be a known managed room.
  async knock(slug: string, guestName: string): Promise<{ knockId: string }> {
    await this.requireRoom(slug);
    const knock = this.state.addKnock(slug, guestName);
    return { knockId: knock.knockId };
  }

  // Guest withdraws their request (cancelled before being admitted).
  // Idempotent: returns ok whether or not the knock still existed.
  cancelKnock(slug: string, knockId: string): { ok: true } {
    this.state.removeKnock(slug, knockId);
    return { ok: true };
  }

  // Guest polls for the host's decision.
  knockStatus(slug: string, knockId: string): KnockStatusResult {
    const knock = this.requireKnock(slug, knockId);
    if (knock.status === 'admitted') {
      return {
        status: 'admitted',
        token: knock.token,
        identity: knock.identity,
        livekitUrl: this.livekit.livekitUrl,
      };
    }
    return { status: knock.status };
  }

  listKnocks(slug: string) {
    return {
      knocks: this.state.listPendingKnocks(slug).map((k) => ({
        knockId: k.knockId,
        name: k.name,
        requestedAt: k.requestedAt,
      })),
    };
  }

  async admit(slug: string, knockId: string): Promise<{ status: string }> {
    const knock = this.requireKnock(slug, knockId);
    if (knock.status === 'pending') {
      const identity = makeIdentity(knock.name);
      const token = await this.livekit.mintToken({
        room: slug,
        identity,
        name: knock.name,
      });
      this.state.resolveKnock(knock, 'admitted', { identity, token });
    }
    return { status: knock.status };
  }

  deny(slug: string, knockId: string): { status: string } {
    const knock = this.requireKnock(slug, knockId);
    if (knock.status === 'pending') {
      this.state.resolveKnock(knock, 'denied');
    }
    return { status: knock.status };
  }

  async mute(slug: string, identity: string, muted: boolean) {
    await this.livekit.setParticipantMuted(slug, identity, muted);
    return { ok: true };
  }

  async remove(slug: string, identity: string) {
    await this.livekit.removeParticipant(slug, identity);
    return { ok: true };
  }

  // Called from the verified LiveKit webhook when a room ends. The room record
  // is persistent and kept; we just drop its now-stale waiting-room knocks.
  onRoomFinished(slug: string): void {
    this.state.clearKnocks(slug);
  }

  private async mintHostJoin(
    room: Room,
    hostName: string,
  ): Promise<HostJoinResult> {
    const identity = makeIdentity(hostName);
    await this.livekit.createRoom(room.slug);
    const token = await this.livekit.mintToken({
      room: room.slug,
      identity,
      name: hostName,
      host: true,
    });
    return {
      room: room.slug,
      title: room.title,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
      identity,
      token,
      hostKey: room.hostKey,
      livekitUrl: this.livekit.livekitUrl,
    };
  }

  private toSummary(room: Room): RoomSummary {
    return {
      room: room.slug,
      title: room.title,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
      hostKey: room.hostKey,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private async requireRoom(slug: string): Promise<Room> {
    const room = await this.repo.findBySlug(slug);
    if (!room) {
      throw new NotFoundException('No such room — ask the host to create it');
    }
    return room;
  }

  private requireKnock(slug: string, knockId: string): Knock {
    const knock = this.state.getKnock(slug, knockId);
    if (!knock) throw new NotFoundException('Unknown or expired knock');
    return knock;
  }
}
