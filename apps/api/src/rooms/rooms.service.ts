import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { makeIdentity } from './identity';
import { LivekitService } from './livekit.service';
import { Knock, RoomStateService } from './rooms.state';

export interface CreateRoomResult {
  room: string;
  identity: string;
  token: string;
  hostKey: string;
  livekitUrl: string;
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
    private readonly state: RoomStateService,
    private readonly livekit: LivekitService,
  ) {}

  // Host creates a managed room and receives a host token + host key.
  async createRoom(
    roomName: string,
    hostName: string,
  ): Promise<CreateRoomResult> {
    if (this.state.getRoom(roomName)) {
      throw new ConflictException('A room with that name already exists');
    }
    const identity = makeIdentity(hostName);
    const room = this.state.createRoom(roomName, identity);
    await this.livekit.createRoom(roomName);
    const token = await this.livekit.mintToken({
      room: roomName,
      identity,
      name: hostName,
      host: true,
    });
    return {
      room: roomName,
      identity,
      token,
      hostKey: room.hostKey,
      livekitUrl: this.livekit.livekitUrl,
    };
  }

  // Guest knocks; must be a known managed room.
  knock(roomName: string, guestName: string): { knockId: string } {
    if (!this.state.getRoom(roomName)) {
      throw new NotFoundException('No such room — ask the host to create it');
    }
    const knock = this.state.addKnock(roomName, guestName);
    return { knockId: knock.knockId };
  }

  // Guest withdraws their request (cancelled before being admitted).
  // Idempotent: returns ok whether or not the knock still existed.
  cancelKnock(roomName: string, knockId: string): { ok: true } {
    this.state.removeKnock(roomName, knockId);
    return { ok: true };
  }

  // Guest polls for the host's decision.
  knockStatus(roomName: string, knockId: string): KnockStatusResult {
    const knock = this.requireKnock(roomName, knockId);
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

  listKnocks(roomName: string) {
    return {
      knocks: this.state.listPendingKnocks(roomName).map((k) => ({
        knockId: k.knockId,
        name: k.name,
        requestedAt: k.requestedAt,
      })),
    };
  }

  async admit(roomName: string, knockId: string): Promise<{ status: string }> {
    const knock = this.requireKnock(roomName, knockId);
    if (knock.status === 'pending') {
      const identity = makeIdentity(knock.name);
      const token = await this.livekit.mintToken({
        room: roomName,
        identity,
        name: knock.name,
      });
      this.state.resolveKnock(knock, 'admitted', { identity, token });
    }
    return { status: knock.status };
  }

  deny(roomName: string, knockId: string): { status: string } {
    const knock = this.requireKnock(roomName, knockId);
    if (knock.status === 'pending') {
      this.state.resolveKnock(knock, 'denied');
    }
    return { status: knock.status };
  }

  async mute(roomName: string, identity: string, muted: boolean) {
    await this.livekit.setParticipantMuted(roomName, identity, muted);
    return { ok: true };
  }

  async remove(roomName: string, identity: string) {
    await this.livekit.removeParticipant(roomName, identity);
    return { ok: true };
  }

  // Called from the verified LiveKit webhook when a room ends.
  onRoomFinished(roomName: string): void {
    this.state.removeRoom(roomName);
  }

  private requireKnock(roomName: string, knockId: string): Knock {
    const knock = this.state.getKnock(roomName, knockId);
    if (!knock) throw new NotFoundException('Unknown or expired knock');
    return knock;
  }
}
