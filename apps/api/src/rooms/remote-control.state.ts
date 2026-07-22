import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export const REMOTE_CONTROL_REQUEST_TTL_MS = 30_000;
export const REMOTE_CONTROL_RENEWAL_MS = 30 * 60_000;
export const REMOTE_CONTROL_BOOTSTRAP_TTL_MS = 2 * 60_000;

// Keep the Redis owner/grant around briefly beyond the consent deadline so the
// expiry reconciler can atomically finish Postgres + metadata before another
// request acquires the room. The deadline itself is always enforced in service
// and by the Control Agent; this is storage grace, not extra control time.
const ACTIVE_STORAGE_TTL_SECONDS = 31 * 60;

export interface PendingRemoteControlRequest {
  requestId: string;
  room: string;
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  requestedAt: string;
  expiresAt: string;
  // Runtime-only upper bound inherited from the Controller's one-hour
  // x-participant-token. It is never exposed or written to the audit row.
  controllerTokenExpiresAt: string;
}

export interface ActiveRemoteControlGrant {
  sessionId: string;
  room: string;
  roomId: string;
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  agentIdentity: string;
  status: 'awaiting-agent' | 'active';
  agentConnected: boolean;
  startedAt: string;
  renewalDueAt: string;
  // A control session can never outlive either human's original participant
  // bearer. This resolves the existing 1h LiveKit JWT vs repeated 30m renewal
  // mismatch without creating an indefinitely valid participant credential.
  authorizationExpiresAt: string;
  bootstrapDigest?: string;
}

interface BootstrapGrant {
  room: string;
  sessionId: string;
  digest: string;
  expiresAt: string;
}

@Injectable()
export class RemoteControlStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private ownerKey(room: string): string {
    return `huddle:remote-control:owner:${room}`;
  }

  private pendingKey(room: string): string {
    return `huddle:remote-control:pending:${room}`;
  }

  private activeKey(room: string): string {
    return `huddle:remote-control:active:${room}`;
  }

  private bootstrapKey(digest: string): string {
    return `huddle:remote-control:bootstrap:${digest}`;
  }

  async hasOwner(room: string): Promise<boolean> {
    return (await this.redis.get(this.ownerKey(room))) != null;
  }

  // The owner key is the one-room lock shared by pending and active states.
  // SET NX makes request creation race-safe without trusting a prior read.
  async createPending(request: PendingRemoteControlRequest): Promise<boolean> {
    const owner = await this.redis.set(this.ownerKey(request.room), request.requestId, 'EX', Math.ceil(REMOTE_CONTROL_REQUEST_TTL_MS / 1000), 'NX');
    if (owner !== 'OK') return false;

    try {
      await this.redis.set(this.pendingKey(request.room), JSON.stringify(request), 'EX', Math.ceil(REMOTE_CONTROL_REQUEST_TTL_MS / 1000));
      return true;
    } catch (error) {
      await this.releaseOwner(request.room, request.requestId);
      throw error;
    }
  }

  async getPending(room: string, requestId: string): Promise<PendingRemoteControlRequest | undefined> {
    const pending = await this.readJson<PendingRemoteControlRequest>(this.pendingKey(room));
    return pending?.requestId === requestId && pending.room === room ? pending : undefined;
  }

  // GETDEL ensures approve and deny cannot both consume the same request.
  async consumePending(room: string, requestId: string): Promise<PendingRemoteControlRequest | undefined> {
    // Check the room owner before GETDEL. Without this guard, a caller who
    // guessed any other request id could consume the real pending request and
    // leave the legitimate Sharer with a false "expired" prompt.
    if ((await this.redis.get(this.ownerKey(room))) !== requestId) return undefined;
    const raw = await this.redis.getdel(this.pendingKey(room));
    if (!raw) return undefined;
    const pending = this.parseJson<PendingRemoteControlRequest>(raw);
    if (!pending || pending.requestId !== requestId || pending.room !== room) return undefined;
    return pending;
  }

  async releasePending(room: string, requestId: string): Promise<void> {
    const pending = await this.getPending(room, requestId);
    if (pending) await this.redis.del(this.pendingKey(room));
    await this.releaseOwner(room, requestId);
  }

  // Transition the already-held room lock from pending to active. The room owner
  // never disappears between the two states, so a new request cannot race in.
  async activate(grant: ActiveRemoteControlGrant): Promise<boolean> {
    const owner = await this.redis.get(this.ownerKey(grant.room));
    if (owner !== grant.sessionId) return false;

    const active = await this.redis.set(this.activeKey(grant.room), JSON.stringify(grant), 'EX', ACTIVE_STORAGE_TTL_SECONDS, 'NX');
    if (active !== 'OK') return false;

    const extendedOwner = await this.redis.set(this.ownerKey(grant.room), grant.sessionId, 'EX', ACTIVE_STORAGE_TTL_SECONDS, 'XX');
    if (extendedOwner !== 'OK') {
      await this.redis.del(this.activeKey(grant.room));
      return false;
    }
    return true;
  }

  async getActive(room: string): Promise<ActiveRemoteControlGrant | undefined> {
    const grant = await this.readJson<ActiveRemoteControlGrant>(this.activeKey(room));
    return grant?.room === room ? grant : undefined;
  }

  async updateActive(grant: ActiveRemoteControlGrant): Promise<boolean> {
    const current = await this.getActive(grant.room);
    if (!current || current.sessionId !== grant.sessionId) return false;

    const active = await this.redis.set(this.activeKey(grant.room), JSON.stringify(grant), 'EX', ACTIVE_STORAGE_TTL_SECONDS, 'XX');
    const owner = await this.redis.set(this.ownerKey(grant.room), grant.sessionId, 'EX', ACTIVE_STORAGE_TTL_SECONDS, 'XX');
    return active === 'OK' && owner === 'OK';
  }

  async clearActive(room: string, sessionId: string): Promise<boolean> {
    const current = await this.getActive(room);
    if (!current || current.sessionId !== sessionId) return false;
    await this.redis.del(this.activeKey(room));
    await this.releaseOwner(room, sessionId);
    return true;
  }

  async issueBootstrap(grant: ActiveRemoteControlGrant): Promise<{ bootstrapCode: string; expiresAt: string }> {
    const bootstrapCode = randomBytes(32).toString('base64url');
    const digest = this.digest(bootstrapCode);
    const expiresAt = new Date(Date.now() + REMOTE_CONTROL_BOOTSTRAP_TTL_MS).toISOString();
    const bootstrap: BootstrapGrant = {
      room: grant.room,
      sessionId: grant.sessionId,
      digest,
      expiresAt,
    };
    await this.redis.set(this.bootstrapKey(digest), JSON.stringify(bootstrap), 'EX', Math.ceil(REMOTE_CONTROL_BOOTSTRAP_TTL_MS / 1000));

    const updated = await this.updateActive({ ...grant, bootstrapDigest: digest });
    if (!updated) {
      await this.redis.del(this.bootstrapKey(digest));
      throw new Error('Remote Control grant disappeared while issuing bootstrap');
    }
    return { bootstrapCode, expiresAt };
  }

  async consumeBootstrap(room: string, sessionId: string, bootstrapCode: string): Promise<BootstrapGrant | undefined> {
    const digest = this.digest(bootstrapCode);
    const raw = await this.redis.getdel(this.bootstrapKey(digest));
    if (!raw) return undefined;
    const grant = this.parseJson<BootstrapGrant>(raw);
    if (!grant || grant.digest !== digest || grant.room !== room || grant.sessionId !== sessionId) return undefined;
    return grant;
  }

  async revokeBootstrap(grant: ActiveRemoteControlGrant): Promise<void> {
    if (grant.bootstrapDigest) await this.redis.del(this.bootstrapKey(grant.bootstrapDigest));
  }

  private async releaseOwner(room: string, expectedId: string): Promise<void> {
    const owner = await this.redis.get(this.ownerKey(room));
    if (owner === expectedId) await this.redis.del(this.ownerKey(room));
  }

  private async readJson<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    return raw ? this.parseJson<T>(raw) : undefined;
  }

  private parseJson<T>(raw: string): T | undefined {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
  }
}
