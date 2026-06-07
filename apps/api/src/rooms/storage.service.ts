import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';

// Reads recordings back out of S3/MinIO. Egress writes the file directly to the
// bucket (via the internal endpoint); the API reads it through the host-facing
// endpoint so it can stream a download to the host's browser. The browser never
// gets bucket credentials — downloads are proxied through the host-authorized
// API route.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly bucket: string;
  // Endpoint Egress uses to upload (reachable from inside the docker network).
  readonly internalEndpoint: string;
  readonly region: string;
  readonly accessKey: string;
  readonly secretKey: string;

  private _client?: S3Client;
  private _bucketReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    if (!bucket || !accessKey || !secretKey) {
      throw new InternalServerErrorException('Recording storage misconfigured');
    }
    this.bucket = bucket;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    this.internalEndpoint =
      this.config.get<string>('S3_ENDPOINT_INTERNAL') ?? 'http://minio:9000';
  }

  private get client(): S3Client {
    return (this._client ??= new S3Client({
      // Host-facing endpoint; path-style is required for MinIO.
      endpoint:
        this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000',
      region: this.region,
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
      forcePathStyle: true,
    }));
  }

  // Idempotently ensure the bucket exists. Memoised so concurrent recordings
  // don't race to create it. Called before the first egress upload happens.
  ensureBucket(): Promise<void> {
    return (this._bucketReady ??= this.createBucketIfMissing());
  }

  private async createBucketIfMissing(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      // Not found (or no access) — try to create it below.
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created recordings bucket "${this.bucket}"`);
    } catch (err) {
      // A concurrent create or an already-owned bucket is fine.
      this.logger.warn(
        `Could not create bucket "${this.bucket}": ${String(err)}`,
      );
    }
  }

  // Stream an object back for a download. Returns the body plus the size so the
  // route can set Content-Length.
  async getObject(
    key: string,
  ): Promise<{ body: Readable; size?: number; contentType?: string }> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      body: res.Body as Readable,
      size: res.ContentLength,
      contentType: res.ContentType,
    };
  }
}
