import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// In-memory state for waiting-room knocks. Knocks are inherently ephemeral
// (a guest waiting right now), so they stay in-process even though rooms
// themselves are now persisted in Postgres (see rooms.repo.ts). Single-node
// only — moving this to Redis is Phase 9 hardening.

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
  private readonly knocks = new Map<string, Knock>();

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

  // Drop all knocks for a room (called when a LiveKit room finishes). The room
  // record itself is persistent and is intentionally NOT deleted here.
  clearKnocks(room: string): void {
    for (const [id, knock] of this.knocks) {
      if (knock.room === room) this.knocks.delete(id);
    }
  }
}
