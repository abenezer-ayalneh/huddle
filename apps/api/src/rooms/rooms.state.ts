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
  status: KnockStatus;
  requestedAt: number;
  // Populated once the host admits the guest.
  identity?: string;
  token?: string;
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

  async addKnock(room: string, name: string): Promise<Knock> {
    const knock: Knock = {
      knockId: randomUUID(),
      room,
      name,
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

    const raws = await this.redis.mget(
      ids.map((id) => this.knockKey(room, id)),
    );
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
  async resolveKnock(
    knock: Knock,
    status: Exclude<KnockStatus, 'pending'>,
    grant?: { identity: string; token: string },
  ): Promise<void> {
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

  private async writeKnock(knock: Knock): Promise<void> {
    await this.redis.set(
      this.knockKey(knock.room, knock.knockId),
      JSON.stringify(knock),
      'EX',
      KNOCK_TTL_SECONDS,
    );
  }
}
