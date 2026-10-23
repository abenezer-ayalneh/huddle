/** Local-only HTTP + Redis + MinIO multipart roundtrip. No WebRTC claim. */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { json } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DeleteBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import request from 'supertest';
import { ChatFilesController } from '../src/rooms/chat-files.controller';
import { ChatFilesService, type ChatFileRecord } from '../src/rooms/chat-files.service';
import { ParticipantGuard } from '../src/rooms/participant.guard';
import { LivekitService } from '../src/rooms/livekit.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';

async function main() {
  const env = { ...parse(readFileSync(resolve(__dirname, '../../../.env'))), ...process.env };
  for (let pass = 0; pass < 5; pass++)
    for (const key of Object.keys(env)) env[key] = env[key]?.replace(/\$\{([^}]+)\}/g, (_match, name: string) => env[name] ?? '');
  for (const url of [env.S3_ENDPOINT, env.REDIS_URL ?? 'redis://localhost:6379'])
    assert(['localhost', '127.0.0.1'].includes(new URL(url!).hostname), 'Smoke test requires local-only stores');
  const suffix = randomUUID();
  const bucket = `huddle-chat-smoke-${suffix}`;
  const partBytes = 5 * 1024 ** 2;
  const fileBytes = partBytes + 7;
  const config = new ConfigService({ ...env, S3_CHAT_BUCKET: bucket, CHAT_FILE_MAX_BYTES: String(fileBytes + 1) });
  const redis = new Redis(env.REDIS_URL ?? 'redis://localhost:6379', { keyPrefix: `huddle:chat-smoke:${suffix}:` });
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
  });
  const livekit = {
    verifyParticipantToken: (token: string) =>
      Promise.resolve(
        token === 'smoke-token' ? { identity: 'smoke-person', room: 'smoke-room', name: 'Smoke', role: 'guest', tokenExpiresAt: Date.now() + 60_000 } : null,
      ),
    getRoomSid: () => Promise.resolve('RM_smoke'),
    getConnectedParticipant: () => Promise.resolve({ identity: 'smoke-person', role: 'guest' }),
  };
  const module = await Test.createTestingModule({
    controllers: [ChatFilesController],
    providers: [
      ChatFilesService,
      ParticipantGuard,
      { provide: ConfigService, useValue: config },
      { provide: LivekitService, useValue: livekit },
      { provide: REDIS_CLIENT, useValue: redis },
    ],
  }).compile();
  const app = module.createNestApplication({ bodyParser: false });
  app.use(json());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const http = request(app.getHttpServer() as Server);
  const base = '/rooms/smoke-room/chat-files';
  const auth = { 'x-participant-token': 'smoke-token' };
  let fileId: string | undefined;
  try {
    await http.post(base).send({ name: 'notes.txt', size: 7 }).expect(401);
    await http
      .post(base)
      .set(auth)
      .send({ name: 'notes.txt', size: fileBytes + 2 })
      .expect(400);
    const created = await http.post(base).set(auth).send({ name: 'notes.txt', size: fileBytes }).expect(201);
    fileId = (created.body as { id: string }).id;
    await http.put(`${base}/${fileId}/parts/1`).set(auth).set('content-type', 'application/octet-stream').send(Buffer.alloc(partBytes, 97)).expect(200);
    await http.put(`${base}/${fileId}/parts/2`).set(auth).set('content-type', 'application/octet-stream').send(Buffer.from('payload')).expect(200);
    await http.post(`${base}/${fileId}/complete`).set(auth).expect(201);
    const info = await http.get(`${base}/${fileId}`).set(auth).expect(200);
    const downloaded = await http
      .get(`${base}/${fileId}/download`)
      .query({ token: (info.body as { downloadToken: string }).downloadToken })
      .expect(200);
    const content: unknown = downloaded.body;
    assert(Buffer.isBuffer(content));
    assert.equal(content.length, fileBytes);
    assert.equal(content.subarray(-7).toString(), 'payload');
    assert.match(downloaded.headers['content-disposition'], /^attachment;/);
    await http
      .get(`${base}/${fileId}/download`)
      .query({ token: `${(info.body as { downloadToken: string }).downloadToken}x` })
      .expect(403);
    const recordKey = `huddle:chat-file:${fileId}`;
    const record = JSON.parse((await redis.get(recordKey))!) as ChatFileRecord;
    record.expiresAt = Date.now() - 1;
    await redis.set(recordKey, JSON.stringify(record));
    await redis.zadd('huddle:chat-files:expiry', record.expiresAt, fileId);
    await http.get(`${base}/${fileId}`).set(auth).expect(404);
    await module.get(ChatFilesService).cleanup();
    await assert.rejects(
      s3.send(new HeadObjectCommand({ Bucket: bucket, Key: record.key })),
      (error: { $metadata?: { httpStatusCode?: number } }) => error.$metadata?.httpStatusCode === 404,
    );
    const empty = await http.post(base).set(auth).send({ name: 'empty.txt', size: 0 }).expect(201);
    fileId = (empty.body as { id: string }).id;
    await http.post(`${base}/${fileId}/complete`).set(auth).expect(201);
    const emptyInfo = await http.get(`${base}/${fileId}`).set(auth).expect(200);
    await http
      .get(`${base}/${fileId}/download`)
      .query({ token: (emptyInfo.body as { downloadToken: string }).downloadToken })
      .expect('content-length', '0')
      .expect(200);
    console.log(
      'PASS: real local HTTP/Redis/MinIO two-part and empty-file upload, native download, authorization, size limit, token tampering, exact expiry, and object cleanup',
    );
  } finally {
    if (fileId) {
      const raw = await redis.get(`huddle:chat-file:${fileId}`);
      if (raw) {
        const record = JSON.parse(raw) as ChatFileRecord;
        record.expiresAt = Date.now() - 1;
        await redis.set(`huddle:chat-file:${fileId}`, JSON.stringify(record));
        await redis.zadd('huddle:chat-files:expiry', record.expiresAt, fileId);
        await module.get(ChatFilesService).cleanup();
      }
    }
    await app.close();
    await s3.send(new DeleteBucketCommand({ Bucket: bucket })).catch(() => {});
    s3.destroy();
    await redis.quit();
  }
}
void main().catch(() => {
  console.error('FAIL: local chat storage smoke test (inspect local services and configuration)');
  process.exitCode = 1;
});
