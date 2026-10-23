import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Readable } from 'node:stream';
import { S3Client, UploadPartCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ChatFilesService, MAX_CHAT_FILE_BYTES } from './chat-files.service';
import type { LivekitService } from './livekit.service';

class FileRedis {
  records = new Map<string, string>();
  expiry = new Map<string, number>();
  get = jest.fn((key: string) => Promise.resolve(this.records.get(key) ?? null));
  set = jest.fn((key: string, value: string) => {
    this.records.set(key, value);
    return Promise.resolve('OK');
  });
  del = jest.fn((key: string) => {
    this.records.delete(key);
    return Promise.resolve(1);
  });
  zadd = jest.fn((_key: string, score: number, id: string) => {
    this.expiry.set(id, score);
    return Promise.resolve(1);
  });
  zrem = jest.fn((_key: string, id: string) => {
    this.expiry.delete(id);
    return Promise.resolve(1);
  });
  zrangebyscore = jest.fn((_key: string, _min: number, max: number) => Promise.resolve([...this.expiry].filter(([, score]) => score <= max).map(([id]) => id)));
}
const sender = { identity: 'sender', name: 'Sender' };
const reader = { identity: 'reader', name: 'Reader' };
describe('ChatFilesService', () => {
  let redis: FileRedis;
  let livekit: { getRoomSid: jest.Mock; getConnectedParticipant: jest.Mock };
  let service: ChatFilesService;
  let send: jest.SpyInstance<Promise<unknown>, [unknown]>;
  beforeEach(() => {
    redis = new FileRedis();
    livekit = { getRoomSid: jest.fn().mockResolvedValue('RM_one'), getConnectedParticipant: jest.fn().mockResolvedValue({ role: 'guest' }) };
    send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.SpyInstance<Promise<unknown>, [unknown]>;
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof UploadPartCommand) {
        for await (const _chunk of command.input.Body as Readable) {
          void _chunk;
        }
        return { ETag: 'confirmed-part' };
      }
      return { UploadId: 'upload-id', Body: Readable.from(['abc']) };
    });
    const values: Record<string, string> = { LIVEKIT_API_SECRET: 'test-only-key', S3_BUCKET: 'recordings', S3_ACCESS_KEY: 'test', S3_SECRET_KEY: 'test' };
    service = new ChatFilesService(
      { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] } as ConfigService,
      livekit as unknown as LivekitService,
      redis as unknown as Redis,
    );
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
  });
  async function complete() {
    const upload = await service.create('room', sender, 'notes.txt', 3);
    await service.uploadPart('room', upload.id, sender, 1, 3, Readable.from(['abc']));
    await service.complete('room', upload.id, sender);
    return upload;
  }
  it('streams a complete file and issues a reader-bound download token', async () => {
    const upload = await complete();
    const info = await service.info('room', upload.id, reader);
    expect(info).toMatchObject({ name: 'notes.txt', identity: 'sender', size: 3 });
    await expect(service.download('room', upload.id, info.downloadToken)).resolves.toMatchObject({ name: 'notes.txt', size: 3 });
    expect(livekit.getConnectedParticipant).toHaveBeenLastCalledWith('room', 'reader');
    await expect(service.download('other', upload.id, info.downloadToken)).rejects.toThrow();
    await expect(service.download('room', upload.id, info.downloadToken + 'x')).rejects.toThrow();
  });
  it('supports empty files without leaving an incomplete multipart upload', async () => {
    const file = await service.create('room', sender, 'empty.txt', 0);
    await service.complete('room', file.id, sender);
    await expect(service.info('room', file.id, reader)).resolves.toMatchObject({ size: 0 });
  });
  it('rejects not-connected users, foreign calls, and another participant modifying an upload', async () => {
    const upload = await service.create('room', sender, 'notes.txt', 3);
    await expect(service.uploadPart('room', upload.id, reader, 1, 3, Readable.from(['abc']))).rejects.toThrow('Not your active upload');
    livekit.getRoomSid.mockResolvedValue('RM_new');
    await expect(service.uploadPart('room', upload.id, sender, 1, 3, Readable.from(['abc']))).rejects.toThrow();
    livekit.getConnectedParticipant.mockResolvedValue(null);
    await expect(service.create('room', sender, 'notes.txt', 3)).rejects.toThrow();
  });
  it('rejects incomplete, oversized, malformed, and short uploads', async () => {
    await expect(service.create('room', sender, 'notes.txt', MAX_CHAT_FILE_BYTES + 1)).rejects.toThrow();
    await expect(service.create('room', sender, 'bad\nname', 3)).rejects.toThrow();
    const upload = await service.create('room', sender, 'notes.txt', 3);
    await expect(service.complete('room', upload.id, sender)).rejects.toThrow('Upload is incomplete');
    await expect(service.uploadPart('room', upload.id, sender, 1, 4, Readable.from(['abcd']))).rejects.toThrow();
    await expect(service.uploadPart('room', upload.id, sender, 1, 3, Readable.from(['ab']))).rejects.toThrow('Incomplete upload part');
  });
  it('denies access immediately at 24 hours and removes expired objects', async () => {
    const upload = await complete();
    const info = await service.info('room', upload.id, reader);
    jest.spyOn(Date, 'now').mockReturnValue(upload.expiresAt + 1);
    await expect(service.info('room', upload.id, reader)).rejects.toThrow('expired');
    await expect(service.download('room', upload.id, info.downloadToken)).rejects.toThrow();
    await service.cleanup();
    expect(redis.records.size).toBe(0);
    expect(redis.expiry.size).toBe(0);
    expect(send.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(true);
  });
});
