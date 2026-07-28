import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

// Waiting-room knock state, backed by Redis (see
// docs/adr/0005-knock-state-to-redis.md). Knocks are ephemeral — a guest
// waiting right now — but keeping them in Redis (rather than an in-process Map)
// means they survive an API restart/deploy, and a TTL lets abandoned knocks
// self-expire instead of lingering forever. The API stays single-instance; this
// is not (yet) the multi-instance pub/sub design.

export type KnockStatus = 'pending' | 'admitted' | 'denied';

export interface Knock {
  knockId: string;
  room: string;
  name: string;
  // Present only when the guest was signed in while knocking. This is captured
  // from the BetterAuth session, never from the request body, and is used to
  // create a Direct Rejoin Grant when the host admits the guest.
  userId?: string;
  // The guest's Avatar URL, resolved server-side from their session at knock time
  // (docs/adr/0016). Carried here until admit, when it is minted into the token
  // metadata. Absent for anonymous guests and accounts without a picture.
  image?: string | null;
  status: KnockStatus;
  requestedAt: number;
  // Populated once the host admits the guest.
  identity?: string;
  token?: string;
}

export interface DirectRejoinGrant {
  grantId: string;
  room: string;
  roomSid: string;
  userId: string;
  identity: string;
  createdAt: number;
}

// Recording Share Consent is call-instance scoped. It is never durable
// membership: room_finished clears it, and a later room with the same Room Code
// starts with no participant sharing authority.
export interface RecordingShareConsent {
  room: string;
  roomSid: string;
  userId: string;
  identity: string;
  accountBinding: string;
  consentedAt: number;
}

// How long a knock lives before Redis evicts it. Comfortably longer than a guest
// would wait in the lobby, short enough that abandoned knocks don't pile up.
const KNOCK_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class RoomStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // One JSON blob per knock (carries its own TTL); plus a per-room index set so
  // we can list a room's pending knocks without scanning the keyspace.
  private knockKey(room: string, knockId: string): string {
    return `huddle:knock:${room}:${knockId}`;
  }
  private indexKey(room: string): string {
    return `huddle:knocks:${room}`;
  }
  private directRejoinKey(room: string, userId: string): string {
    return `huddle:direct-rejoin:${room}:${userId}`;
  }
  private directRejoinIdentityKey(room: string, identity: string): string {
    return `huddle:direct-rejoin-identity:${room}:${identity}`;
  }
  private directRejoinIndexKey(room: string): string {
    return `huddle:direct-rejoin-users:${room}`;
  }
  private recordingShareConsentKey(room: string, roomSid: string, userId: string): string {
    return `huddle:recording-share-consent:${room}:${roomSid}:${userId}`;
  }
  private recordingShareConsentIdentityKey(room: string, roomSid: string, identity: string): string {
    return `huddle:recording-share-consent-identity:${room}:${roomSid}:${identity}`;
  }
  private recordingShareConsentIndexKey(room: string, roomSid: string): string {
    return `huddle:recording-share-consent-users:${room}:${roomSid}`;
  }

  async addKnock(room: string, name: string, image?: string | null, userId?: string): Promise<Knock> {
    const knock: Knock = {
      knockId: randomUUID(),
      room,
      name,
      userId,
      image: image ?? null,
      status: 'pending',
      requestedAt: Date.now(),
    };
    await this.writeKnock(knock);
    await this.redis.sadd(this.indexKey(room), knock.knockId);
    // Keep the index set alive at least as long as any knock it points to.
    await this.redis.expire(this.indexKey(room), KNOCK_TTL_SECONDS);
    return knock;
  }

  async getKnock(room: string, knockId: string): Promise<Knock | undefined> {
    const raw = await this.redis.get(this.knockKey(room, knockId));
    if (!raw) return undefined;
    const knock = JSON.parse(raw) as Knock;
    return knock.room === room ? knock : undefined;
  }

  async listPendingKnocks(room: string): Promise<Knock[]> {
    const ids = await this.redis.smembers(this.indexKey(room));
    if (ids.length === 0) return [];

    const raws = await this.redis.mget(ids.map((id) => this.knockKey(room, id)));
    const pending: Knock[] = [];
    const expired: string[] = [];
    ids.forEach((id, i) => {
      const raw = raws[i];
      if (raw == null) {
        // Knock TTL'd out but its id lingers in the index — prune it lazily.
        expired.push(id);
        return;
      }
      const knock = JSON.parse(raw) as Knock;
      if (knock.status === 'pending') pending.push(knock);
    });
    if (expired.length > 0) {
      await this.redis.srem(this.indexKey(room), ...expired);
    }
    return pending;
  }

  // Advance a knock (admit/deny) and persist it, refreshing its TTL so an
  // admitted guest can still poll for their token before it expires.
  async resolveKnock(knock: Knock, status: Exclude<KnockStatus, 'pending'>, grant?: { identity: string; token: string }): Promise<void> {
    knock.status = status;
    if (grant) {
      knock.identity = grant.identity;
      knock.token = grant.token;
    }
    await this.writeKnock(knock);
  }

  // Withdraw a knock (guest cancelled). Idempotent — no-op if already gone.
  async removeKnock(room: string, knockId: string): Promise<void> {
    await this.redis.del(this.knockKey(room, knockId));
    await this.redis.srem(this.indexKey(room), knockId);
  }

  // Drop all knocks for a room (called when a LiveKit room finishes). The room
  // record itself is persistent and is intentionally NOT deleted here.
  async clearKnocks(room: string): Promise<void> {
    const ids = await this.redis.smembers(this.indexKey(room));
    if (ids.length > 0) {
      await this.redis.del(...ids.map((id) => this.knockKey(room, id)));
    }
    await this.redis.del(this.indexKey(room));
  }

  // Direct Rejoin Grants are call-scoped authority, not durable membership.
  // They intentionally have no clock TTL: the matching LiveKit room_finished
  // event ends them, while room-SID validation rejects stale state if a webhook
  // is delayed or missed.
  async addDirectRejoinGrant(params: { room: string; roomSid: string; userId: string; identity: string }): Promise<DirectRejoinGrant> {
    const previous = await this.getDirectRejoinGrant(params.room, params.userId);
    if (previous) {
      await this.redis.del(this.directRejoinIdentityKey(params.room, previous.identity));
    }

    const grant: DirectRejoinGrant = {
      grantId: randomUUID(),
      room: params.room,
      roomSid: params.roomSid,
      userId: params.userId,
      identity: params.identity,
      createdAt: Date.now(),
    };
    await this.redis.set(this.directRejoinKey(params.room, params.userId), JSON.stringify(grant));
    await this.redis.set(this.directRejoinIdentityKey(params.room, params.identity), params.userId);
    await this.redis.sadd(this.directRejoinIndexKey(params.room), params.userId);
    return grant;
  }

  async getDirectRejoinGrant(room: string, userId: string): Promise<DirectRejoinGrant | undefined> {
    const raw = await this.redis.get(this.directRejoinKey(room, userId));
    if (!raw) return undefined;
    const grant = JSON.parse(raw) as DirectRejoinGrant;
    return grant.room === room && grant.userId === userId ? grant : undefined;
  }

  async getDirectRejoinGrantByIdentity(room: string, identity: string): Promise<DirectRejoinGrant | undefined> {
    const userId = await this.redis.get(this.directRejoinIdentityKey(room, identity));
    if (!userId) return undefined;
    const grant = await this.getDirectRejoinGrant(room, userId);
    return grant?.identity === identity ? grant : undefined;
  }

  async removeDirectRejoinGrant(grant: DirectRejoinGrant): Promise<void> {
    const current = await this.getDirectRejoinGrant(grant.room, grant.userId);
    if (current?.grantId !== grant.grantId) return;
    await this.redis.del(this.directRejoinKey(grant.room, grant.userId), this.directRejoinIdentityKey(grant.room, grant.identity));
    await this.redis.srem(this.directRejoinIndexKey(grant.room), grant.userId);
  }

  async revokeDirectRejoinGrantByIdentity(room: string, identity: string): Promise<DirectRejoinGrant | undefined> {
    const grant = await this.getDirectRejoinGrantByIdentity(room, identity);
    if (!grant) return undefined;
    await this.removeDirectRejoinGrant(grant);
    return grant;
  }

  // A Room Code may later back a new LiveKit room instance. Remove only grants
  // for the SID that actually finished so a delayed webhook cannot revoke the
  // new call's admission state.
  async clearDirectRejoinGrants(room: string, roomSid: string): Promise<void> {
    const userIds = await this.redis.smembers(this.directRejoinIndexKey(room));
    if (userIds.length === 0) return;
    const raws = await this.redis.mget(userIds.map((userId) => this.directRejoinKey(room, userId)));
    const grants = raws
      .filter((raw): raw is string => raw != null)
      .map((raw) => JSON.parse(raw) as DirectRejoinGrant)
      .filter((grant) => grant.roomSid === roomSid);
    await Promise.all(grants.map((grant) => this.removeDirectRejoinGrant(grant)));
  }

  async addRecordingShareConsent(params: Omit<RecordingShareConsent, 'consentedAt'>): Promise<RecordingShareConsent> {
    const previous = await this.getRecordingShareConsent(params.room, params.roomSid, params.userId);
    if (previous && previous.identity !== params.identity) {
      await this.redis.del(this.recordingShareConsentIdentityKey(params.room, params.roomSid, previous.identity));
    }
    const consent: RecordingShareConsent = { ...params, consentedAt: Date.now() };
    await this.redis.set(this.recordingShareConsentKey(params.room, params.roomSid, params.userId), JSON.stringify(consent));
    await this.redis.set(this.recordingShareConsentIdentityKey(params.room, params.roomSid, params.identity), params.userId);
    await this.redis.sadd(this.recordingShareConsentIndexKey(params.room, params.roomSid), params.userId);
    return consent;
  }

  async getRecordingShareConsent(room: string, roomSid: string, userId: string): Promise<RecordingShareConsent | undefined> {
    const raw = await this.redis.get(this.recordingShareConsentKey(room, roomSid, userId));
    if (!raw) return undefined;
    const consent = JSON.parse(raw) as RecordingShareConsent;
    return consent.room === room && consent.roomSid === roomSid && consent.userId === userId ? consent : undefined;
  }

  async getRecordingShareConsentByIdentity(room: string, roomSid: string, identity: string): Promise<RecordingShareConsent | undefined> {
    const userId = await this.redis.get(this.recordingShareConsentIdentityKey(room, roomSid, identity));
    if (!userId) return undefined;
    const consent = await this.getRecordingShareConsent(room, roomSid, userId);
    return consent?.identity === identity ? consent : undefined;
  }

  async listRecordingShareConsents(room: string, roomSid: string): Promise<RecordingShareConsent[]> {
    const userIds = await this.redis.smembers(this.recordingShareConsentIndexKey(room, roomSid));
    if (userIds.length === 0) return [];
    const consents = await Promise.all(userIds.map((userId) => this.getRecordingShareConsent(room, roomSid, userId)));
    return consents.filter((consent): consent is RecordingShareConsent => consent != null);
  }

  async clearRecordingShareConsents(room: string, roomSid: string): Promise<void> {
    const consents = await this.listRecordingShareConsents(room, roomSid);
    const keys = consents.flatMap((consent) => [
      this.recordingShareConsentKey(room, roomSid, consent.userId),
      this.recordingShareConsentIdentityKey(room, roomSid, consent.identity),
    ]);
    if (keys.length > 0) await this.redis.del(...keys);
    await this.redis.del(this.recordingShareConsentIndexKey(room, roomSid));
  }

  private async writeKnock(knock: Knock): Promise<void> {
    await this.redis.set(this.knockKey(knock.room, knock.knockId), JSON.stringify(knock), 'EX', KNOCK_TTL_SECONDS);
  }
}
