import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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
    this.internalEndpoint = this.config.get<string>('S3_ENDPOINT_INTERNAL') ?? 'http://minio:9000';
  }

  private get client(): S3Client {
    return (this._client ??= new S3Client({
      // Host-facing endpoint; path-style is required for MinIO.
      endpoint: this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000',
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
  // A failure is NOT cached: a later attempt (e.g. after fixing credentials)
  // can retry without restarting the API.
  ensureBucket(): Promise<void> {
    return (this._bucketReady ??= this.createBucketIfMissing().catch((err: unknown) => {
      this._bucketReady = undefined;
      throw err;
    }));
  }

  private async createBucketIfMissing(): Promise<void> {
    // Fast path: bucket already exists and our credentials work.
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch (err) {
      // A 404 means the bucket is simply missing — create it below. Anything
      // else (403 bad signature, store unreachable) is a real failure we must
      // NOT swallow, or the recording starts and silently fails to upload.
      if (!this.isNotFound(err)) throw this.storageError('reach', err);
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created recordings bucket "${this.bucket}"`);
    } catch (err) {
      // A concurrent create or an already-owned bucket is fine; bad credentials
      // or an unreachable store must surface, not be logged away.
      if (this.isAlreadyOwned(err)) return;
      throw this.storageError('create the recordings bucket in', err);
    }
  }

  private statusOf(err: unknown): number | undefined {
    return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  }

  private nameOf(err: unknown): string {
    return (err as { name?: string })?.name ?? '';
  }

  private isNotFound(err: unknown): boolean {
    return this.statusOf(err) === 404 || this.nameOf(err) === 'NotFound' || this.nameOf(err) === 'NoSuchBucket';
  }

  private isAlreadyOwned(err: unknown): boolean {
    const name = this.nameOf(err);
    return name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists';
  }

  // Log the underlying S3 detail (for ops) and return an opaque error to throw —
  // the caller turns it into a clean Fault so internals never reach the client.
  private storageError(verb: string, err: unknown): Error {
    const detail = err instanceof Error ? err.message : String(err);
    this.logger.error(`Could not ${verb} recording storage "${this.bucket}": ${detail}`);
    return new Error(`recording storage unavailable: ${detail}`);
  }

  // Stream an object back for a download. Returns the body plus the size so the
  // route can set Content-Length.
  async getObject(key: string): Promise<{ body: Readable; size?: number; contentType?: string }> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      body: res.Body as Readable,
      size: res.ContentLength,
      contentType: res.ContentType,
    };
  }

  // Drive's resumable uploader requests a deterministic byte range at a time.
  // Keeping those reads server-side means neither MinIO credentials nor a
  // presigned object URL are exposed to Google or the browser.
  async getObjectRange(key: string, start: number, endInclusive: number): Promise<{ body: Readable; size?: number }> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=${start}-${endInclusive}`,
      }),
    );
    return { body: res.Body as Readable, size: res.ContentLength };
  }

  // S3/MinIO deletion is idempotent. The worker marks the database row only
  // after this call succeeds so a temporary object-store failure is retried.
  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
