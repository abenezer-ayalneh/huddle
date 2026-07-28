import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, TokenVerifier, TrackSource, WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';

export interface ParticipantClaims {
  identity: string;
  name?: string;
  room?: string;
  role?: string;
  tokenExpiresAt: number;
}

export interface ConnectedParticipant {
  identity: string;
  name: string;
  role?: string;
}

export interface DirectRejoinTokenMetadata {
  grantId: string;
  roomSid: string;
}

export interface RemoteControlRoomState {
  sessionId: string;
  status: 'awaiting-agent' | 'active';
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  agentIdentity: string;
  agentConnected: boolean;
  renewalDueAt: string;
}

// Thin wrapper over the LiveKit server SDK: minting tokens and room admin.
// Authority lives here (uses the API secret); never trusted from the client.
@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  // Public ws:// or wss:// URL handed to browsers; httpUrl stays server-local
  // for admin REST calls and egress.
  readonly livekitUrl: string;
  private readonly httpUrl: string;

  private _svc?: RoomServiceClient;
  private _webhook?: WebhookReceiver;
  private _verifier?: TokenVerifier;
  private readonly metadataWrites = new Map<string, Promise<void>>();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const livekitUrl = this.config.get<string>('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new InternalServerErrorException('LiveKit service misconfigured');
    }
    const publicLivekitUrl = this.config.get<string>('LIVEKIT_PUBLIC_URL') || livekitUrl;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.livekitUrl = publicLivekitUrl;
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

  // Verify a participant's own join token (we signed it) and return its claims.
  // Holding a valid, unexpired token for a room is the authority for
  // participant-scoped in-call actions. Returns null for anything invalid or
  // expired.
  async verifyParticipantToken(token: string): Promise<ParticipantClaims | null> {
    try {
      const claims = await this.verifier.verify(token);
      if (!claims.sub) return null;
      const metadata = this.parseMetadata(claims.metadata);
      return {
        identity: claims.sub,
        name: claims.name,
        room: claims.video?.room,
        role: typeof metadata.role === 'string' ? metadata.role : undefined,
        tokenExpiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : 0,
      };
    } catch {
      return null;
    }
  }

  // Mint a join token. `host` adds roomAdmin + a role=host metadata claim so the
  // frontend can show host UI (authority is still enforced server-side). The
  // optional `image` is the participant's Avatar URL (docs/adr/0016): resolved
  // server-side from the session, carried in metadata so every client can render
  // it; omitted from the metadata when absent (anonymous guest, no picture).
  async mintToken(opts: {
    room: string;
    identity: string;
    name: string;
    host?: boolean;
    image?: string | null;
    directRejoin?: DirectRejoinTokenMetadata;
  }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: opts.identity,
      name: opts.name,
      ttl: '1h',
      metadata: JSON.stringify({
        role: opts.host ? 'host' : 'guest',
        avatarUrl: opts.image ?? undefined,
        directRejoinGrantId: opts.directRejoin?.grantId,
        directRejoinRoomSid: opts.directRejoin?.roomSid,
      }),
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

  // A narrowly scoped token for the native macOS Control Agent. It is visible to
  // the SFU so clients can subscribe to its screen track, but its signed role lets
  // Huddle filter it out of people-facing UI (docs/adr/0024).
  async mintControlAgentToken(opts: {
    room: string;
    sessionId: string;
    sharerIdentity: string;
    controllerIdentity: string;
    agentIdentity: string;
  }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: opts.agentIdentity,
      name: 'Control Agent',
      // The bootstrap bearer is two minutes; the resulting agent token must
      // survive the 30-minute Sharer reconfirmation window. Its authority is
      // still bounded by the room metadata projection and the grant's human
      // participant-token deadline.
      ttl: '1h',
      metadata: JSON.stringify({
        role: 'control-agent',
        room: opts.room,
        sessionId: opts.sessionId,
        sharerIdentity: opts.sharerIdentity,
        controllerIdentity: opts.controllerIdentity,
        agentIdentity: opts.agentIdentity,
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: opts.room,
      canPublish: true,
      canPublishSources: [TrackSource.SCREEN_SHARE],
      canSubscribe: true,
      // The agent may send only recipient-targeted, locally validated clipboard
      // updates to its exact Controller. Its media remains screen-share-only.
      canPublishData: true,
      roomAdmin: false,
      hidden: false,
    });
    return at.toJwt();
  }

  async createRoom(name: string): Promise<string> {
    const room = await this.svc.createRoom({ name });
    return room.sid;
  }

  async getRoomSid(name: string): Promise<string | null> {
    const [room] = await this.svc.listRooms([name]);
    return room?.sid ?? null;
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    await this.svc.removeParticipant(room, identity, {
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
    });
  }

  async disconnectControlAgent(room: string, identity: string): Promise<void> {
    await this.svc.removeParticipant(room, identity, {
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
    });
  }

  async getConnectedParticipant(room: string, identity: string): Promise<ConnectedParticipant | null> {
    const participants = await this.svc.listParticipants(room);
    const participant = participants.find((candidate) => candidate.identity === identity);
    if (!participant) return null;
    const metadata = this.parseMetadata(participant.metadata);
    return {
      identity: participant.identity,
      name: participant.name || participant.identity,
      role: typeof metadata.role === 'string' ? metadata.role : undefined,
    };
  }

  directRejoinMetadata(metadata?: string): DirectRejoinTokenMetadata | null {
    const parsed = this.parseMetadata(metadata);
    return typeof parsed.directRejoinGrantId === 'string' && typeof parsed.directRejoinRoomSid === 'string'
      ? { grantId: parsed.directRejoinGrantId, roomSid: parsed.directRejoinRoomSid }
      : null;
  }

  async hasActiveScreenShare(room: string): Promise<boolean> {
    const participants = await this.svc.listParticipants(room);
    return participants.some((participant) => participant.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE));
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
    await this.mutateRoomMetadata(room, (meta) => {
      if (meta.muteOnEntry === muted) return false;
      meta.muteOnEntry = muted;
      return true;
    });
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

  // --- Recording Indicator (see docs/adr/0011) --------------------------
  // A room-wide "a recording is active" flag, kept in the room metadata so
  // LiveKit pushes it to every client in real time — the same mechanism as
  // Mute on Entry. Its purpose is consent: no one is recorded without an
  // on-screen signal, regardless of who started the recording.
  async setRecordingActive(room: string, active: boolean): Promise<void> {
    await this.mutateRoomMetadata(room, (meta) => {
      if ((meta.recording === true) === active) return false;
      meta.recording = active;
      // Stamp (or clear) the recording start time alongside the flag, so every
      // client can show a live recording timer off the same real-time metadata
      // propagation. Only written on the off→true transition.
      if (active) {
        meta.recordingStartedAt = Date.now();
      } else {
        delete meta.recordingStartedAt;
      }
      return true;
    });
  }

  async stampStartedAt(room: string): Promise<void> {
    await this.mutateRoomMetadata(room, (meta) => {
      if (meta.startedAt) return false;
      meta.startedAt = Date.now();
      return true;
    });
  }

  async clearStartedAt(room: string): Promise<void> {
    await this.mutateRoomMetadata(room, (meta) => {
      if (!meta.startedAt) return false;
      delete meta.startedAt;
      return true;
    });
  }

  // Display-safe projection of the Redis Remote Control grant. Serialized with
  // recording/mute metadata writes so concurrent consent and recording changes
  // do not replace one another's keys in the single API process.
  async setRemoteControlState(room: string, state: RemoteControlRoomState | null): Promise<void> {
    await this.mutateRoomMetadata(room, (meta) => {
      if (state) {
        meta.remoteControl = state;
        return true;
      }
      if (!('remoteControl' in meta)) return false;
      delete meta.remoteControl;
      return true;
    });
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
    return this.parseMetadata(metadata).role === 'host';
  }

  private parseMetadata(metadata?: string): Record<string, unknown> {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async mutateRoomMetadata(room: string, mutate: (metadata: Record<string, unknown>) => boolean): Promise<void> {
    const previous = this.metadataWrites.get(room) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const [info] = await this.svc.listRooms([room]);
        const metadata = this.parseMetadata(info?.metadata);
        if (!mutate(metadata)) return;
        await this.svc.updateRoomMetadata(room, JSON.stringify(metadata));
      });
    this.metadataWrites.set(room, current);
    try {
      await current;
    } finally {
      if (this.metadataWrites.get(room) === current) this.metadataWrites.delete(room);
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

  async receiveWebhook(body: string, authHeader?: string): Promise<WebhookEvent> {
    return this.webhook.receive(body, authHeader);
  }
}
