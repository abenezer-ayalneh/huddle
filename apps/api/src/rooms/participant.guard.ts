import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { FaultCode, faultBody } from '../common/faults';
import { LivekitService } from './livekit.service';

// The in-call participant making the request, proven by their own LiveKit
// join token (the `x-participant-token` header). Participant-scoped actions
// need no host key or account session, just the token we minted when they
// joined.
export interface CallParticipant {
  identity: string;
  name: string;
  role?: string;
  accountBinding?: string;
  // Present on requests resolved from a LiveKit JWT. Optional keeps this
  // lightweight value object compatible with existing service unit tests that
  // construct participants directly.
  tokenExpiresAt?: number;
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
      throw new UnauthorizedException(faultBody(FaultCode.NOT_PARTICIPANT, 'Missing participant token'));
    }

    const claims = await this.livekit.verifyParticipantToken(token);
    if (!claims || claims.room !== slug || claims.tokenExpiresAt <= Date.now() || claims.role === 'control-agent') {
      throw new UnauthorizedException(faultBody(FaultCode.NOT_PARTICIPANT, 'Not a participant of this room'));
    }

    req.participant = {
      identity: claims.identity,
      name: claims.name || claims.identity,
      role: claims.role,
      accountBinding: claims.accountBinding,
      tokenExpiresAt: claims.tokenExpiresAt,
    };
    return true;
  }
}

// Injects the participant resolved by ParticipantGuard into a handler.
export const Participant = createParamDecorator((_data: unknown, context: ExecutionContext): CallParticipant => {
  const req = context.switchToHttp().getRequest<RequestWithParticipant>();
  return req.participant as CallParticipant;
});
