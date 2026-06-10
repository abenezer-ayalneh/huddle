import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { LivekitService } from './livekit.service';

// The in-call participant making the request, proven by their own LiveKit
// join token (the `x-participant-token` header). Anyone in the call may
// present, so anyone in the call may pair a Control Agent — no host key and
// no account session required, just the token we minted when they joined.
export interface CallParticipant {
  identity: string;
  name: string;
}

type RequestWithParticipant = Request & { participant?: CallParticipant };

@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(private readonly livekit: LivekitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithParticipant>();
    const slug = String(req.params.room);
    const headerVal = req.headers['x-participant-token'];
    const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!token) {
      throw new UnauthorizedException('Missing participant token');
    }

    const claims = await this.livekit.verifyParticipantToken(token);
    if (!claims || claims.room !== slug) {
      throw new UnauthorizedException('Not a participant of this room');
    }

    req.participant = {
      identity: claims.identity,
      name: claims.name || claims.identity,
    };
    return true;
  }
}

// Injects the participant resolved by ParticipantGuard into a handler.
export const Participant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CallParticipant => {
    const req = context.switchToHttp().getRequest<RequestWithParticipant>();
    return req.participant as CallParticipant;
  },
);
