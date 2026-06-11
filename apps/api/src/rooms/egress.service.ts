import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk';
import { StorageService } from './storage.service';

// Wraps the LiveKit Egress server SDK to record the composited room to MP4 and
// upload it to S3/MinIO. The upload target is built from the API's env and
// handed to Egress per-request (so the egress container holds no S3 creds). The
// API secret lives here, never on the client.
@Injectable()
export class EgressService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly httpUrl: string;

  private _client?: EgressClient;

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const livekitUrl = this.config.get<string>('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new InternalServerErrorException('Egress service misconfigured');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.httpUrl = livekitUrl.replace(/^ws/, 'http');
  }

  private get client(): EgressClient {
    return (this._client ??= new EgressClient(this.httpUrl, this.apiKey, this.apiSecret));
  }

  // Start a room-composite recording. The bucket must already exist (the caller
  // ensures it). Returns the egress id + the object key the file will land at.
  async startRoomComposite(slug: string, objectKey: string): Promise<{ egressId: string }> {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: objectKey,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: this.storage.accessKey,
          secret: this.storage.secretKey,
          bucket: this.storage.bucket,
          region: this.storage.region,
          endpoint: this.storage.internalEndpoint,
          forcePathStyle: true,
        }),
      },
    });

    const info = await this.client.startRoomCompositeEgress(slug, output, {
      layout: 'grid',
    });
    return { egressId: info.egressId };
  }

  async stop(egressId: string): Promise<void> {
    await this.client.stopEgress(egressId);
  }
}
