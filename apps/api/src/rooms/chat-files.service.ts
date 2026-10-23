import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
  UploadPartCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { LivekitService } from './livekit.service';
import type { CallParticipant } from './participant.guard';

const DAY = 86_400_000;
const MIN_PART = 5 * 1024 ** 2;
export const MAX_CHAT_FILE_BYTES = 5 * 1024 ** 3 * 10_000;
const EXPIRY_INDEX = 'huddle:chat-files:expiry';
export interface ChatFileRecord {
  id: string;
  room: string;
  roomSid: string;
  identity: string;
  name: string;
  size: number;
  key: string;
  uploadId: string;
  partSize: number;
  parts: { PartNumber: number; ETag: string }[];
  expiresAt: number;
  completed: boolean;
}

@Injectable()
export class ChatFilesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatFilesService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  readonly maxBytes: number;
  private ready?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private cleaning = false;
  constructor(
    private readonly config: ConfigService,
    private readonly livekit: LivekitService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.bucket = config.get<string>('S3_CHAT_BUCKET') ?? 'huddle-chat';
    if (this.bucket === config.get<string>('S3_BUCKET')) throw new Error('S3_CHAT_BUCKET must be separate from the recordings bucket');
    this.maxBytes = Number(config.get<string>('CHAT_FILE_MAX_BYTES') ?? MAX_CHAT_FILE_BYTES);
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > MAX_CHAT_FILE_BYTES)
      throw new Error('CHAT_FILE_MAX_BYTES is outside multipart storage limits');
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000',
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: config.get<string>('S3_ACCESS_KEY') ?? '', secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? '' },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.cleanup().catch(() => {
        this.logger.warn('Chat file cleanup failed; expired access remains blocked and cleanup will retry.');
      });
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.client.destroy();
  }
  private recordKey(id: string) {
    return `huddle:chat-file:${id}`;
  }
  private async save(record: ChatFileRecord) {
    await this.redis.set(this.recordKey(record.id), JSON.stringify(record));
  }
  private async connected(room: string, participant: CallParticipant, roomSid?: string) {
    const [sid, current] = await Promise.all([this.livekit.getRoomSid(room), this.livekit.getConnectedParticipant(room, participant.identity)]);
    if (!sid || !current || current.role === 'control-agent' || (roomSid && roomSid !== sid)) throw new ForbiddenException('Join this call to use chat files');
    return sid;
  }
  private ensureBucket() {
    return (this.ready ??= this.prepareBucket().catch((error: unknown) => {
      this.ready = undefined;
      throw error;
    }));
  }
  private async prepareBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (createError) {
        if ((createError as { name?: string }).name !== 'BucketAlreadyOwnedByYou') throw createError;
      }
    }
    // This bucket is dedicated to chat. Lifecycle provides a recovery safety net
    // if Redis is lost; API access expires exactly at expiresAt regardless.
    await this.client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'chat-24h',
              Status: 'Enabled',
              Filter: { Prefix: 'chat/' },
              Expiration: { Days: 1 },
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
            },
          ],
        },
      }),
    );
  }
  async create(room: string, participant: CallParticipant, name: string, size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.maxBytes) throw new BadRequestException('File size exceeds the configured object-storage limit');
    if (!name.trim() || name.length > 255 || [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
      throw new BadRequestException('Invalid file name');
    const roomSid = await this.connected(room, participant);
    await this.ensureBucket();
    const id = randomUUID();
    const key = `chat/${roomSid}/${id}`;
    const upload =
      size === 0
        ? { UploadId: '' }
        : await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: 'application/octet-stream' }));
    if (size > 0 && !upload.UploadId) throw new Error('Object storage did not start an upload');
    const record: ChatFileRecord = {
      id,
      room,
      roomSid,
      identity: participant.identity,
      name: name.split(/[\\/]/).pop() || 'attachment',
      size,
      key,
      uploadId: upload.UploadId!,
      partSize: Math.max(MIN_PART, Math.ceil(size / 10_000)),
      parts: [],
      expiresAt: Date.now() + DAY,
      completed: false,
    };
    try {
      await this.redis.zadd(EXPIRY_INDEX, record.expiresAt, id);
      await this.save(record);
    } catch (error) {
      if (upload.UploadId) await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: upload.UploadId }));
      throw error;
    }
    return { id, partSize: record.partSize, maxBytes: this.maxBytes, expiresAt: record.expiresAt };
  }
  private async load(room: string, id: string) {
    const raw = await this.redis.get(this.recordKey(id));
    if (!raw) throw new NotFoundException('File is unavailable or expired');
    const record = JSON.parse(raw) as ChatFileRecord;
    if (record.room !== room || record.expiresAt <= Date.now()) throw new NotFoundException('File is unavailable or expired');
    return record;
  }
  private async owned(room: string, id: string, participant: CallParticipant) {
    const record = await this.load(room, id);
    await this.connected(room, participant, record.roomSid);
    if (record.identity !== participant.identity || record.completed) throw new ForbiddenException('Not your active upload');
    return record;
  }
  async uploadPart(room: string, id: string, participant: CallParticipant, number: number, length: number, body: Readable) {
    const record = await this.owned(room, id, participant);
    // Sequential parts bound metadata writes and make retry of the current part safe.
    if (!Number.isInteger(number) || number < 1 || number > 10_000 || number > record.parts.length + 1) throw new BadRequestException('Invalid upload part');
    const expected = Math.min(record.partSize, record.size - (number - 1) * record.partSize);
    if (expected <= 0 || length !== expected) throw new BadRequestException('Upload part length does not match the file');
    async function* bounded() {
      let received = 0;
      for await (const chunk of body) {
        received += (chunk as Buffer).length;
        if (received > expected) throw new BadRequestException('Upload part too large');
        yield chunk as Buffer;
      }
      if (received !== expected) throw new BadRequestException('Incomplete upload part');
    }
    const result = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: record.key,
        UploadId: record.uploadId,
        PartNumber: number,
        ContentLength: expected,
        Body: Readable.from(bounded()),
      }),
    );
    if (!result.ETag) throw new Error('Object storage did not confirm the part');
    record.parts[number - 1] = { PartNumber: number, ETag: result.ETag };
    await this.save(record);
    return { uploaded: number };
  }
  async complete(room: string, id: string, participant: CallParticipant) {
    const record = await this.owned(room, id, participant);
    if (record.parts.length !== Math.ceil(record.size / record.partSize)) throw new BadRequestException('Upload is incomplete');
    if (record.size === 0)
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: record.key, Body: new Uint8Array(), ContentType: 'application/octet-stream' }));
    else
      await this.client.send(
        new CompleteMultipartUploadCommand({ Bucket: this.bucket, Key: record.key, UploadId: record.uploadId, MultipartUpload: { Parts: record.parts } }),
      );
    record.completed = true;
    await this.save(record);
    return { id: record.id };
  }
  async cancel(room: string, id: string, participant: CallParticipant) {
    const record = await this.owned(room, id, participant);
    await this.remove(record);
    return { cancelled: true };
  }
  private signature(payload: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('LIVEKIT_API_SECRET')).update(`chat-download:${payload}`).digest('base64url');
  }
  async info(room: string, id: string, participant: CallParticipant) {
    const record = await this.load(room, id);
    await this.connected(room, participant, record.roomSid);
    if (!record.completed) throw new NotFoundException('File is not ready');
    const payload = Buffer.from(
      JSON.stringify({ id, room, sid: record.roomSid, identity: participant.identity, exp: Math.min(Date.now() + 300_000, record.expiresAt) }),
    ).toString('base64url');
    return {
      id,
      name: record.name,
      size: record.size,
      identity: record.identity,
      expiresAt: record.expiresAt,
      downloadToken: `${payload}.${this.signature(payload)}`,
    };
  }
  async download(room: string, id: string, token: string) {
    if (!token || token.length > 2048) throw new ForbiddenException('Invalid download token');
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) throw new ForbiddenException('Invalid download token');
    const expected = Buffer.from(this.signature(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ForbiddenException('Invalid download token');
    let grant: { id: string; room: string; sid: string; identity: string; exp: number };
    try {
      const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid grant');
      const value = parsed as Partial<typeof grant>;
      if (
        typeof value.id !== 'string' ||
        typeof value.room !== 'string' ||
        typeof value.sid !== 'string' ||
        typeof value.identity !== 'string' ||
        typeof value.exp !== 'number' ||
        !Number.isFinite(value.exp)
      )
        throw new Error('Invalid grant');
      grant = { id: value.id, room: value.room, sid: value.sid, identity: value.identity, exp: value.exp };
    } catch {
      throw new ForbiddenException('Invalid download token');
    }
    if (grant.id !== id || grant.room !== room || grant.exp <= Date.now()) throw new ForbiddenException('Expired download token');
    const record = await this.load(room, id);
    if (!record.completed || record.roomSid !== grant.sid) throw new ForbiddenException('File does not belong to this call');
    await this.connected(room, { identity: grant.identity, name: '' }, record.roomSid);
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: record.key }));
    return { body: object.Body as Readable, name: record.name, size: record.size };
  }
  private async remove(record: ChatFileRecord) {
    // Always try both: a complete request may have succeeded before its Redis write.
    if (!record.completed && record.uploadId) {
      try {
        await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: record.key, UploadId: record.uploadId }));
      } catch (error) {
        if ((error as { name?: string }).name !== 'NoSuchUpload') throw error;
      }
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: record.key }));
    await this.redis.del(this.recordKey(record.id));
    await this.redis.zrem(EXPIRY_INDEX, record.id);
  }
  async cleanup() {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      const ids = await this.redis.zrangebyscore(EXPIRY_INDEX, 0, Date.now(), 'LIMIT', 0, 100);
      for (const id of ids) {
        const raw = await this.redis.get(this.recordKey(id));
        if (raw) await this.remove(JSON.parse(raw) as ChatFileRecord);
        else await this.redis.zrem(EXPIRY_INDEX, id);
      }
    } finally {
      this.cleaning = false;
    }
  }
}
