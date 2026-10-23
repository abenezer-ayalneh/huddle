import { BadGatewayException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import nodemailer from 'nodemailer';
import { REDIS_CLIENT } from '../redis/redis.module';
import { buildSignalHandoffEmail } from '../common/signal-handoff-email';
import { RoomRepository } from './rooms.repo';

@Injectable()
export class InvitationsService {
  private transport?: nodemailer.Transporter;
  constructor(
    private readonly config: ConfigService,
    private readonly rooms: RoomRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async send(roomCode: string, email: string) {
    const room = await this.rooms.findBySlug(roomCode);
    if (!room) throw new NotFoundException('Room not found');
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) throw new ServiceUnavailableException('Email invitations are not configured');
    const normalizedEmail = email.trim().toLowerCase();
    const recipientHash = createHash('sha256').update(normalizedEmail).digest('hex');
    const cooldownKey = `huddle:invite:${roomCode}:${recipientHash}`;
    if (!(await this.redis.set(cooldownKey, '1', 'EX', 60, 'NX')))
      throw new HttpException('An invitation was recently sent to this address. Try again in a minute.', 429);
    const rateKey = `huddle:invite-rate:${room.hostUserId}:${Math.floor(Date.now() / 3_600_000)}`;
    const count = await this.redis.incr(rateKey);
    await this.redis.expire(rateKey, 3_600);
    if (count > 50) throw new HttpException('Invitation sending limit reached. Try again later.', 429);
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.transport ??= nodemailer.createTransport({ host, port, secure: port === 465, auth: user && pass ? { user, pass } : undefined });
    const origin = (this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').split(',')[0].trim();
    const url = new URL(`/rooms/${encodeURIComponent(roomCode)}`, origin).toString();
    const scheduled = room.scheduledStart ? ` Scheduled for ${room.scheduledStart.toISOString()} (UTC).` : '';
    const message = buildSignalHandoffEmail({
      route: 'MEETING INVITATION',
      preheader: 'You have been invited to a Huddle meeting.',
      title: 'Join the conversation.',
      body: `You have been invited to Huddle room ${roomCode}.${scheduled}`,
      action: { href: url, label: 'Open meeting' },
      fallbackLabel: 'You can also open this meeting link:',
      note: 'An invitation does not grant entry. Complete Device Check and wait for the Host to admit you.',
    });
    try {
      const result: unknown = await this.transport.sendMail({
        from: { name: 'Huddle', address: this.config.get<string>('SMTP_FROM') ?? user ?? 'no-reply@huddle.local' },
        to: normalizedEmail,
        subject: 'You are invited to a Huddle meeting',
        ...message,
      });
      if (result && typeof result === 'object' && 'rejected' in result && Array.isArray(result.rejected) && result.rejected.length)
        throw new Error('Recipient rejected');
      return { sent: true };
    } catch {
      await this.redis.del(cooldownKey);
      throw new BadGatewayException('The email provider could not accept the invitation. Try again.');
    }
  }
}
