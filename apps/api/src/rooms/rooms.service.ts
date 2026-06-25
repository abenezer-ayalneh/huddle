import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Room } from '@prisma/client';
import { FaultCode, faultBody } from '../common/faults';
import type { AuthUser } from '../auth/auth.guard';
import { makeIdentity } from './identity';
import { LivekitService } from './livekit.service';
import { RoomRepository } from './rooms.repo';
import { Knock, RoomStateService } from './rooms.state';

export interface HostJoinResult {
  room: string;
  scheduledStart: string | null;
  identity: string;
  token: string;
  hostKey: string;
  livekitUrl: string;
  // Current Mute-on-Entry state, so a (re)joining host's panel reflects it.
  muteOnEntry: boolean;
}

export interface RoomSummary {
  room: string;
  scheduledStart: string | null;
  hostKey: string;
  createdAt: string;
}

export interface KnockStatusResult {
  status: Knock['status'];
  token?: string;
  identity?: string;
  livekitUrl?: string;
  // When admitted, whether the room is muted-on-entry so the guest connects
  // with their microphone off.
  muteOnEntry?: boolean;
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
  async createRoom(host: AuthUser, params: { scheduledStart?: string }): Promise<HostJoinResult> {
    const scheduledStart = params.scheduledStart ? new Date(params.scheduledStart) : null;
    const room = await this.repo.create({
      scheduledStart,
      hostUserId: host.id,
    });
    return this.mintHostJoin(room, host);
  }

  // Owner rejoins their own room later (e.g. a scheduled meeting). Mints a
  // fresh host token; the host key is stable for the life of the room.
  async hostJoin(slug: string, host: AuthUser): Promise<HostJoinResult> {
    const room = await this.requireRoom(slug);
    if (room.hostUserId !== host.id) {
      throw new ForbiddenException(faultBody(FaultCode.NOT_HOST, 'You are not the host of this room'));
    }
    return this.mintHostJoin(room, host);
  }

  // Rooms the signed-in user hosts (with host keys, since they own them).
  async listMine(userId: string): Promise<{ rooms: RoomSummary[] }> {
    const rooms = await this.repo.listByHost(userId);
    return { rooms: rooms.map((r) => this.toSummary(r)) };
  }

  // Public info for a guest landing on a room link (does NOT leak the host key).
  async getPublic(slug: string): Promise<{
    room: string;
    scheduledStart: string | null;
  }> {
    const room = await this.requireRoom(slug);
    return {
      room: room.slug,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
    };
  }

  // Guest knocks; must be a known managed room. The name and Avatar are resolved
  // upstream: a signed-in guest's come from their session, an anonymous guest's
  // name from the request body (docs/adr/0016). Either way a non-empty name is
  // required here. The Avatar is optional and only present for signed-in guests
  // whose account has an image; it is captured now so admit can mint it into the
  // token without access to the guest's session.
  async knock(slug: string, guestName: string | undefined, guestImage?: string | null): Promise<{ knockId: string }> {
    await this.requireRoom(slug);
    const name = guestName?.trim();
    if (!name) {
      throw new BadRequestException(faultBody(FaultCode.NAME_REQUIRED, 'A display name is required to knock.'));
    }
    const knock = await this.state.addKnock(slug, name, guestImage);
    return { knockId: knock.knockId };
  }

  // Guest withdraws their request (cancelled before being admitted).
  // Idempotent: returns ok whether or not the knock still existed.
  async cancelKnock(slug: string, knockId: string): Promise<{ ok: true }> {
    await this.state.removeKnock(slug, knockId);
    return { ok: true };
  }

  // Guest polls for the host's decision.
  async knockStatus(slug: string, knockId: string): Promise<KnockStatusResult> {
    const knock = await this.requireKnock(slug, knockId);
    if (knock.status === 'admitted') {
      return {
        status: 'admitted',
        token: knock.token,
        identity: knock.identity,
        livekitUrl: this.livekit.livekitUrl,
        muteOnEntry: await this.livekit.getMuteOnEntry(slug),
      };
    }
    return { status: knock.status };
  }

  async listKnocks(slug: string) {
    const knocks = await this.state.listPendingKnocks(slug);
    return {
      knocks: knocks.map((k) => ({
        knockId: k.knockId,
        name: k.name,
        image: k.image ?? null,
        requestedAt: k.requestedAt,
      })),
    };
  }

  async admit(slug: string, knockId: string): Promise<{ status: string }> {
    const knock = await this.requireKnock(slug, knockId);
    if (knock.status === 'pending') {
      const identity = makeIdentity(knock.name);
      const token = await this.livekit.mintToken({
        room: slug,
        identity,
        name: knock.name,
        image: knock.image,
      });
      await this.state.resolveKnock(knock, 'admitted', { identity, token });
    }
    return { status: knock.status };
  }

  async deny(slug: string, knockId: string): Promise<{ status: string }> {
    const knock = await this.requireKnock(slug, knockId);
    if (knock.status === 'pending') {
      await this.state.resolveKnock(knock, 'denied');
    }
    return { status: knock.status };
  }

  async mute(slug: string, identity: string, muted: boolean) {
    await this.livekit.setParticipantMuted(slug, identity, muted);
    return { ok: true };
  }

  // Toggle Mute on Entry (see docs/adr/0007). Turning it on also force-mutes
  // everyone present (except the host); turning it off never unmutes anyone — it
  // only stops auto-muting future joiners.
  async setMuteOnEntry(slug: string, muted: boolean): Promise<{ muteOnEntry: boolean }> {
    await this.requireRoom(slug);
    await this.livekit.setMuteOnEntry(slug, muted);
    if (muted) {
      await this.livekit.muteAllMicsExceptHost(slug);
    }
    return { muteOnEntry: muted };
  }

  async remove(slug: string, identity: string) {
    await this.livekit.removeParticipant(slug, identity);
    return { ok: true };
  }

  // Called from the verified LiveKit webhook when a room ends. The room record
  // is persistent and kept; we just drop its now-stale waiting-room knocks.
  async onRoomFinished(slug: string): Promise<void> {
    await this.state.clearKnocks(slug);
  }

  private async mintHostJoin(room: Room, host: AuthUser): Promise<HostJoinResult> {
    const identity = makeIdentity(host.name);
    await this.livekit.createRoom(room.slug);
    const token = await this.livekit.mintToken({
      room: room.slug,
      identity,
      name: host.name,
      host: true,
      image: host.image,
    });
    return {
      room: room.slug,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
      identity,
      token,
      hostKey: room.hostKey,
      livekitUrl: this.livekit.livekitUrl,
      muteOnEntry: await this.livekit.getMuteOnEntry(room.slug),
    };
  }

  private toSummary(room: Room): RoomSummary {
    return {
      room: room.slug,
      scheduledStart: room.scheduledStart?.toISOString() ?? null,
      hostKey: room.hostKey,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private async requireRoom(slug: string): Promise<Room> {
    const room = await this.repo.findBySlug(slug);
    if (!room) {
      throw new NotFoundException(faultBody(FaultCode.ROOM_NOT_FOUND, 'No such room — ask the host to create it'));
    }
    return room;
  }

  private async requireKnock(slug: string, knockId: string): Promise<Knock> {
    const knock = await this.state.getKnock(slug, knockId);
    if (!knock) throw new NotFoundException(faultBody(FaultCode.KNOCK_NOT_FOUND, 'Unknown or expired knock'));
    return knock;
  }
}
