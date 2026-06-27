import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Short-lived signed tokens that authorize a single recording download as a
// plain browser navigation — so the browser drives the download natively (its
// own progress shelf) instead of the app buffering the file into a blob first
// (docs/adr/0022). The token replaces the `x-host-key` header on that one route:
// a header can't ride a `<a download>` navigation, a query-string token can.
//
// Stateless: the token *is* an HMAC over room + recordingId + expiry, so there's
// nothing to store and it stays valid (and reusable) within its window — which
// is what lets the browser's range/retry requests resume the same download.
@Injectable()
export class DownloadTokenService {
  // Long enough to cover a backgrounded tab whose recordings poll is throttled
  // or suspended, short enough to keep the validity window small (docs/adr/0022).
  private static readonly TTL_MS = 5 * 60 * 1000;

  private readonly secret: string;

  constructor(config: ConfigService) {
    const secret = config.get<string>('RECORDING_DOWNLOAD_SECRET');
    if (!secret) {
      // Fail loudly at boot, the same way Egress/Storage do — a missing signing
      // key would otherwise only surface as every download 401-ing at runtime.
      throw new InternalServerErrorException('Recording download signing is misconfigured (RECORDING_DOWNLOAD_SECRET)');
    }
    this.secret = secret;
  }

  // Mint a token that authorizes downloading exactly this recording, for the
  // next TTL_MS. Format: `<expiryEpochMs>.<base64url HMAC>` — room and id live in
  // the URL path, so they're not repeated in the token, just bound by the HMAC.
  sign(room: string, recordingId: string): string {
    const exp = Date.now() + DownloadTokenService.TTL_MS;
    return `${exp}.${this.hmac(room, recordingId, exp)}`;
  }

  // True iff `token` is a well-formed, unexpired signature for this exact
  // recording. Constant-time signature comparison; never throws.
  verify(room: string, recordingId: string, token: string): boolean {
    const dot = token.indexOf('.');
    if (dot < 0) return false;
    const exp = Number(token.slice(0, dot));
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const provided = Buffer.from(token.slice(dot + 1));
    const expected = Buffer.from(this.hmac(room, recordingId, exp));
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }

  private hmac(room: string, recordingId: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${room}:${recordingId}:${exp}`).digest('base64url');
  }
}
