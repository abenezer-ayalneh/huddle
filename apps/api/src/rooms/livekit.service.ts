import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource, WebhookReceiver } from 'livekit-server-sdk';

// The Control Agent joins as `agent:<presenterIdentity>` (docs/adr/0010).
// Must match AGENT_IDENTITY_PREFIX in apps/web/src/lib/controlProtocol.ts.
export const AGENT_IDENTITY_PREFIX = 'agent:';

export interface ParticipantClaims {
  identity: string;
  name?: string;
  room?: string;
}

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
  private _verifier?: TokenVerifier;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const livekitUrl = this.config.get<string>('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new InternalServerErrorException('LiveKit service misconfigured');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.livekitUrl = livekitUrl;
    this.httpUrl = livekitUrl.replace(/^ws/, 'http');
  }

  private get svc(): RoomServiceClient {
    return (this._svc ??= new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret));
  }

  private get webhook(): WebhookReceiver {
    return (this._webhook ??= new WebhookReceiver(this.apiKey, this.apiSecret));
  }

  private get verifier(): TokenVerifier {
    return (this._verifier ??= new TokenVerifier(this.apiKey, this.apiSecret));
  }

  // Verify a participant's own join token (we signed it) and return its
  // claims. Holding a valid, unexpired token for a room *is* the authority for
  // in-call actions like pairing a Control Agent — the same authority that
  // admitted them. Returns null for anything invalid or expired.
  async verifyParticipantToken(token: string): Promise<ParticipantClaims | null> {
    try {
      const claims = await this.verifier.verify(token);
      if (!claims.sub) return null;
      return {
        identity: claims.sub,
        name: claims.name,
        room: claims.video?.room,
      };
    } catch {
      return null;
    }
  }

  // Mint the Control Agent's token (docs/adr/0010): participant
  // `agent:<presenter>`, allowed to publish only the screen-share source and
  // data — never mic/camera, never room admin. Short TTL: the agent redeems
  // its pairing code and joins immediately. The participant `name` is the
  // presenter's, so the share tile is labeled with the human.
  //
  // Deliberately NOT `hidden: true`: LiveKit suppresses a hidden
  // participant's track publications and sender identity along with the
  // participant itself (verified empirically against livekit-server — nobody
  // could subscribe to the hidden agent's screen share). "Never shown as a
  // participant" is enforced by the web UI filtering the agent: identity
  // prefix instead.
  async mintAgentToken(opts: { room: string; presenterIdentity: string; presenterName: string }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: AGENT_IDENTITY_PREFIX + opts.presenterIdentity,
      name: opts.presenterName,
      ttl: '2m',
      metadata: JSON.stringify({
        role: 'agent',
        presenter: opts.presenterIdentity,
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canPublishSources: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
      canPublishData: true,
      canSubscribe: false,
    });
    return at.toJwt();
  }

  // Mint a join token. `host` adds roomAdmin + a role=host metadata claim so the
  // frontend can show host UI (authority is still enforced server-side).
  async mintToken(opts: { room: string; identity: string; name: string; host?: boolean }): Promise<string> {
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

  // --- Mute on Entry (see docs/adr/0007) ---------------------------------
  // The room-level "everyone starts muted" flag lives in the LiveKit room's
  // metadata, so LiveKit pushes it to every connected client in real time.

  // Read the current Mute-on-Entry flag from the room metadata. Missing room or
  // metadata reads as "off".
  async getMuteOnEntry(room: string): Promise<boolean> {
    const [info] = await this.svc.listRooms([room]);
    return this.readMuteOnEntry(info?.metadata);
  }

  // Set the flag, merging into any existing metadata so other keys survive.
  async setMuteOnEntry(room: string, muted: boolean): Promise<void> {
    const [info] = await this.svc.listRooms([room]);
    let meta: Record<string, unknown> = {};
    if (info?.metadata) {
      try {
        meta = JSON.parse(info.metadata) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    meta.muteOnEntry = muted;
    await this.svc.updateRoomMetadata(room, JSON.stringify(meta));
  }

  // Force-mute every non-host microphone currently published in the room. The
  // host is identified by the role=host token metadata claim and skipped (the
  // host is never muted on entry). Returns the number of tracks muted.
  async muteAllMicsExceptHost(room: string): Promise<number> {
    const participants = await this.svc.listParticipants(room);
    let muted = 0;
    await Promise.all(
      participants
        .filter((p) => !this.isHost(p.metadata))
        .flatMap((p) =>
          p.tracks
            .filter((t) => t.source === TrackSource.MICROPHONE && !t.muted)
            .map((t) => {
              muted++;
              return this.svc.mutePublishedTrack(room, p.identity, t.sid, true);
            }),
        ),
    );
    return muted;
  }

  async stampStartedAt(room: string): Promise<void> {
    const [info] = await this.svc.listRooms([room]);
    let meta: Record<string, unknown> = {};
    if (info?.metadata) {
      try {
        meta = JSON.parse(info.metadata) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    if (meta.startedAt) return;
    meta.startedAt = Date.now();
    await this.svc.updateRoomMetadata(room, JSON.stringify(meta));
  }

  async clearStartedAt(room: string): Promise<void> {
    const [info] = await this.svc.listRooms([room]);
    if (!info?.metadata) return;
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(info.metadata) as Record<string, unknown>;
    } catch {
      return;
    }
    if (!meta.startedAt) return;
    delete meta.startedAt;
    await this.svc.updateRoomMetadata(room, JSON.stringify(meta));
  }

  private readMuteOnEntry(metadata?: string): boolean {
    if (!metadata) return false;
    try {
      return (JSON.parse(metadata) as { muteOnEntry?: unknown }).muteOnEntry === true;
    } catch {
      return false;
    }
  }

  private isHost(metadata?: string): boolean {
    if (!metadata) return false;
    try {
      return (JSON.parse(metadata) as { role?: unknown }).role === 'host';
    } catch {
      return false;
    }
  }

  // Force-mute/unmute every microphone track the participant is publishing.
  // No-op if they have no audio track. Returns the number of tracks affected.
  async setParticipantMuted(room: string, identity: string, muted: boolean): Promise<number> {
    const participant = await this.svc.getParticipant(room, identity);
    const audioTracks = participant.tracks.filter((t) => t.source === TrackSource.MICROPHONE);
    await Promise.all(audioTracks.map((t) => this.svc.mutePublishedTrack(room, identity, t.sid, muted)));
    return audioTracks.length;
  }

  async receiveWebhook(body: string, authHeader?: string) {
    return this.webhook.receive(body, authHeader);
  }
}
