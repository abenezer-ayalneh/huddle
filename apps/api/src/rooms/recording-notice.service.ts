import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

// Recording delivery notices are deliberately best-effort: an unavailable SMTP
// server must never retain video beyond its configured hard deadline.
@Injectable()
export class RecordingNoticeService {
  private readonly logger = new Logger(RecordingNoticeService.name);
  private transport?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  async actionRequired(email: string): Promise<void> {
    await this.send(
      email,
      'Action needed: reconnect Google Drive for Huddle recordings',
      'Huddle could not deliver a recording to Google Drive. Reconnect Google Drive from Recordings before the local copy expires.',
    );
  }

  async expiryReminder(email: string): Promise<void> {
    await this.send(
      email,
      'Recording local copy expires in 24 hours',
      'A recording is still only stored on Huddle. Download it or reconnect Google Drive within 24 hours before its local copy is permanently deleted.',
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user ?? 'no-reply@huddle.local';
    this.transport ??= nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    try {
      await this.transport.sendMail({ from: { name: 'Huddle', address: from }, to, subject, text });
    } catch (error) {
      // Do not log recipient addresses, recording names, IDs, or OAuth detail.
      this.logger.warn(`Recording notification delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
