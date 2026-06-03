import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from 'livekit-server-sdk';

// Thin wrapper over the LiveKit server SDK: minting tokens and room admin.
// Authority lives here (uses the API secret); never trusted from the client.
@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  // ws:// URL handed to the browser; http:// URL for the admin REST client.
  readonly livekitUrl: string;
  private readonly httpUrl: string;

  private _svc?: RoomServiceClient;
  private _webhook?: WebhookReceiver;

  constructor() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new InternalServerErrorException('LiveKit service misconfigured');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.livekitUrl = livekitUrl;
    this.httpUrl = livekitUrl.replace(/^ws/, 'http');
  }

  private get svc(): RoomServiceClient {
    return (this._svc ??= new RoomServiceClient(
      this.httpUrl,
      this.apiKey,
      this.apiSecret,
    ));
  }

  private get webhook(): WebhookReceiver {
    return (this._webhook ??= new WebhookReceiver(this.apiKey, this.apiSecret));
  }

  // Mint a join token. `host` adds roomAdmin + a role=host metadata claim so the
  // frontend can show host UI (authority is still enforced server-side).
  async mintToken(opts: {
    room: string;
    identity: string;
    name: string;
    host?: boolean;
  }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: opts.identity,
      name: opts.name,
      ttl: '1h',
      metadata: JSON.stringify({ role: opts.host ? 'host' : 'guest' }),
    });
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: opts.host ?? false,
    });
    return at.toJwt();
  }

  async createRoom(name: string): Promise<void> {
    await this.svc.createRoom({ name });
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    await this.svc.removeParticipant(room, identity);
  }

  // Force-mute/unmute every microphone track the participant is publishing.
  // No-op if they have no audio track. Returns the number of tracks affected.
  async setParticipantMuted(
    room: string,
    identity: string,
    muted: boolean,
  ): Promise<number> {
    const participant = await this.svc.getParticipant(room, identity);
    const audioTracks = participant.tracks.filter(
      (t) => t.source === TrackSource.MICROPHONE,
    );
    await Promise.all(
      audioTracks.map((t) =>
        this.svc.mutePublishedTrack(room, identity, t.sid, muted),
      ),
    );
    return audioTracks.length;
  }

  async receiveWebhook(body: string, authHeader?: string) {
    return this.webhook.receive(body, authHeader);
  }
}
