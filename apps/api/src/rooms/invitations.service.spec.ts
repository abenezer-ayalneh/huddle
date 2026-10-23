import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import nodemailer from 'nodemailer';
import { InvitationsService } from './invitations.service';
import type { RoomRepository } from './rooms.repo';

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
describe('InvitationsService', () => {
  const sendMail = jest.fn<Promise<{ accepted: string[]; rejected: string[] }>, [{ to: string; text: string }]>();
  const redis = { set: jest.fn(), incr: jest.fn(), expire: jest.fn(), del: jest.fn() };
  const repo = { findBySlug: jest.fn() };
  let values: Record<string, string>;
  let service: InvitationsService;
  beforeEach(() => {
    jest.clearAllMocks();
    values = { SMTP_HOST: 'smtp.example', WEB_ORIGIN: 'https://huddle.example,https://other.example' };
    repo.findBySlug.mockResolvedValue({ hostUserId: 'host', scheduledStart: new Date('2030-01-01T10:00:00Z') });
    redis.set.mockResolvedValue('OK');
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    sendMail.mockResolvedValue({ accepted: ['guest@example.com'], rejected: [] });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    service = new InvitationsService({ get: (key: string) => values[key] } as ConfigService, repo as unknown as RoomRepository, redis as unknown as Redis);
  });
  it('sends a private invitation with the scheduled time and ordinary admission link', async () => {
    await expect(service.send('abc-defg-hij', 'Guest@Example.com')).resolves.toEqual({ sent: true });
    expect(sendMail.mock.calls[0][0].to).toBe('guest@example.com');
    expect(sendMail.mock.calls[0][0].text).toContain('https://huddle.example/rooms/abc-defg-hij');
    expect(sendMail.mock.calls[0][0].text).toContain('2030-01-01T10:00:00.000Z');
    expect(sendMail.mock.calls[0][0].text).not.toMatch(/hostKey|token=/);
  });
  it('reports missing SMTP rather than claiming delivery', async () => {
    delete values.SMTP_HOST;
    await expect(service.send('room', 'guest@example.com')).rejects.toMatchObject({ status: 503 });
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('enforces recipient cooldown and account-level sending budget', async () => {
    redis.set.mockResolvedValueOnce(null);
    await expect(service.send('room', 'guest@example.com')).rejects.toMatchObject({ status: 429 });
    redis.incr.mockResolvedValueOnce(51);
    await expect(service.send('room', 'guest@example.com')).rejects.toMatchObject({ status: 429 });
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('reports provider failure and allows a retry', async () => {
    sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(service.send('room', 'guest@example.com')).rejects.toMatchObject({ status: 502 });
    expect(redis.del).toHaveBeenCalled();
  });
});
