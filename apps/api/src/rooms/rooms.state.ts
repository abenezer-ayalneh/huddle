import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

// In-memory state for managed rooms and their waiting-room knocks. Single-node
// only — moving this to Redis is Phase 9 hardening (see docs/API_CONTRACT.md).

export interface ManagedRoom {
  name: string;
  hostKey: string;
  hostIdentity: string;
  createdAt: number;
}

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

@Injectable()
export class RoomStateService {
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly knocks = new Map<string, Knock>();

  createRoom(name: string, hostIdentity: string): ManagedRoom {
    const room: ManagedRoom = {
      name,
      hostKey: randomBytes(24).toString('base64url'),
      hostIdentity,
      createdAt: Date.now(),
    };
    this.rooms.set(name, room);
    return room;
  }

  getRoom(name: string): ManagedRoom | undefined {
    return this.rooms.get(name);
  }

  // True only when the supplied key matches the room's host key.
  isHost(name: string, hostKey: string | undefined): boolean {
    if (!hostKey) return false;
    const room = this.rooms.get(name);
    return !!room && room.hostKey === hostKey;
  }

  addKnock(room: string, name: string): Knock {
    const knock: Knock = {
      knockId: randomUUID(),
      room,
      name,
      status: 'pending',
      requestedAt: Date.now(),
    };
    this.knocks.set(knock.knockId, knock);
    return knock;
  }

  getKnock(room: string, knockId: string): Knock | undefined {
    const knock = this.knocks.get(knockId);
    return knock && knock.room === room ? knock : undefined;
  }

  listPendingKnocks(room: string): Knock[] {
    return [...this.knocks.values()].filter(
      (k) => k.room === room && k.status === 'pending',
    );
  }

  resolveKnock(
    knock: Knock,
    status: Exclude<KnockStatus, 'pending'>,
    grant?: { identity: string; token: string },
  ): void {
    knock.status = status;
    if (grant) {
      knock.identity = grant.identity;
      knock.token = grant.token;
    }
  }

  // Withdraw a knock (guest cancelled). Idempotent — no-op if already gone.
  removeKnock(room: string, knockId: string): void {
    const knock = this.knocks.get(knockId);
    if (knock && knock.room === room) this.knocks.delete(knockId);
  }

  // Drop a room and all its knocks (called on the LiveKit room_finished webhook).
  removeRoom(name: string): void {
    this.rooms.delete(name);
    for (const [id, knock] of this.knocks) {
      if (knock.room === name) this.knocks.delete(id);
    }
  }
}
