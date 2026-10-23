/** Sends only to the explicitly local SMTP sink; never a remote provider. */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { HostGuard } from '../src/rooms/host.guard';
import { InvitationsController } from '../src/rooms/invitations.controller';
import { InvitationsService } from '../src/rooms/invitations.service';
import { RoomRepository } from '../src/rooms/rooms.repo';
import { REDIS_CLIENT } from '../src/redis/redis.module';

async function main() {
  const env = { ...parse(readFileSync(resolve(__dirname, '../../../.env'))), ...process.env };
  for (let pass = 0; pass < 5; pass++)
    for (const key of Object.keys(env)) env[key] = env[key]?.replace(/\$\{([^}]+)\}/g, (_match, name: string) => env[name] ?? '');
  assert(['localhost', '127.0.0.1'].includes(env.SMTP_HOST!), 'SMTP smoke requires the local sink');
  assert(['localhost', '127.0.0.1'].includes(new URL(env.REDIS_URL ?? 'redis://localhost:6379').hostname));
  const suffix = randomUUID();
  const redis = new Redis(env.REDIS_URL ?? 'redis://localhost:6379', { keyPrefix: `huddle:invite-smoke:${suffix}:` });
  const config = new ConfigService(env);
  const module = await Test.createTestingModule({
    controllers: [InvitationsController],
    providers: [
      InvitationsService,
      HostGuard,
      { provide: ConfigService, useValue: config },
      { provide: REDIS_CLIENT, useValue: redis },
      {
        provide: RoomRepository,
        useValue: { findBySlug: () => Promise.resolve({ hostKey: 'smoke-host-key', hostUserId: suffix, scheduledStart: new Date('2030-01-01T12:00:00Z') }) },
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const http = request(app.getHttpServer() as Server);
  const recipient = `huddle-smoke-${suffix}@example.invalid`;
  const path = '/rooms/smoke-room/invitations';
  try {
    await http.post(path).send({ email: recipient }).expect(401);
    await http.post(path).set('x-host-key', 'smoke-host-key').send({ email: 'not-an-email' }).expect(400);
    const sent = await http.post(path).set('x-host-key', 'smoke-host-key').send({ email: recipient }).expect(201);
    assert.deepEqual(sent.body, { sent: true });
    await http.post(path).set('x-host-key', 'smoke-host-key').send({ email: recipient }).expect(429);
    console.log('PASS: local SMTP accepts the invitation; HTTP Host authority, email validation, and recipient cooldown pass');
  } finally {
    await app.close();
    await redis.del(
      `huddle:invite:smoke-room:${createHash('sha256').update(recipient).digest('hex')}`,
      `huddle:invite-rate:${suffix}:${Math.floor(Date.now() / 3_600_000)}`,
    );
    await redis.quit();
  }
}
void main().catch(() => {
  console.error('FAIL: local invitation SMTP smoke (check local SMTP and Redis)');
  process.exitCode = 1;
});
