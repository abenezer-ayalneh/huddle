import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { LivekitService } from './livekit.service';
import type { CallParticipant } from './participant.guard';

// Control Agent pairing (docs/adr/0010): the in-call browser mints a one-time
// code; the desktop agent redeems it for a scoped LiveKit token. The code —
// not the token — travels through the huddle:// deep link, so the JWT never
// sits in a URL, and Redis GETDEL makes redemption atomic and single-use.

const CODE_TTL_SECONDS = 60;

export interface AgentLinkResult {
  code: string;
  expiresInSeconds: number;
}

export interface AgentRedeemResult {
  token: string;
  livekitUrl: string;
  room: string;
  presenterIdentity: string;
  presenterName: string;
}

interface AgentLinkPayload {
  room: string;
  identity: string;
  name: string;
}

@Injectable()
export class ControlAgentService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly livekit: LivekitService,
  ) {}

  private codeKey(code: string): string {
    return `huddle:agentcode:${code}`;
  }

  // Room membership is already proven by ParticipantGuard (the token we
  // verified was signed for this room), so no further checks here.
  async createLink(room: string, participant: CallParticipant): Promise<AgentLinkResult> {
    const code = randomBytes(6).toString('base64url');
    const payload: AgentLinkPayload = {
      room,
      identity: participant.identity,
      name: participant.name,
    };
    await this.redis.set(this.codeKey(code), JSON.stringify(payload), 'EX', CODE_TTL_SECONDS, 'NX');
    return { code, expiresInSeconds: CODE_TTL_SECONDS };
  }

  async redeem(code: string): Promise<AgentRedeemResult> {
    // GETDEL: the first redeem wins, every later attempt sees nothing.
    const raw = await this.redis.getdel(this.codeKey(code));
    if (!raw) {
      throw new NotFoundException('Unknown or expired code');
    }
    const { room, identity, name } = JSON.parse(raw) as AgentLinkPayload;
    const token = await this.livekit.mintAgentToken({
      room,
      presenterIdentity: identity,
      presenterName: name,
    });
    return {
      token,
      livekitUrl: this.livekit.livekitUrl,
      room,
      presenterIdentity: identity,
      presenterName: name,
    };
  }
}
