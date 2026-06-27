import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { FaultCode, faultBody } from '../common/faults';
import { DownloadTokenService } from './download-token.service';

// Authorizes the recording-download route by a short-lived signed `?token=`
// rather than the `x-host-key` header (docs/adr/0022) — the only auth form a
// header-less browser navigation can carry. The token is minted into the
// recordings list response and bound to this exact room + recording id.
@Injectable()
export class DownloadTokenGuard implements CanActivate {
  constructor(private readonly tokens: DownloadTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const room = String(req.params.room);
    const id = String(req.params.id);
    const raw = req.query.token;
    const token = Array.isArray(raw) ? raw[0] : raw;

    if (typeof token !== 'string' || !this.tokens.verify(room, id, token)) {
      throw new UnauthorizedException(faultBody(FaultCode.DOWNLOAD_TOKEN_INVALID, 'This download link is invalid or has expired'));
    }
    return true;
  }
}
