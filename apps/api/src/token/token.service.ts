import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

export interface TokenResult {
  token: string;
  livekitUrl: string;
}

@Injectable()
export class TokenService {
  // Mint a short-lived LiveKit access token scoped to {room, identity}.
  // Grants are decided here, never trusted from the client.
  async createToken(
    room: string,
    identity: string,
    name?: string,
  ): Promise<TokenResult> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      // Misconfigured server — do not leak which value is missing.
      throw new InternalServerErrorException('Token service misconfigured');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });

    return { token: await at.toJwt(), livekitUrl };
  }
}
