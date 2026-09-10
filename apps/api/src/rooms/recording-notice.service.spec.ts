import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { RecordingNoticeService } from './recording-notice.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

type ConfigValues = Partial<Record<string, string>>;
type SentMessage = { subject: string; text: string; html: string };

function config(values: ConfigValues): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('RecordingNoticeService', () => {
  const createTransport = nodemailer.createTransport as jest.Mock;
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail });
  });

  it('sends the Google Drive action-required notice through the shared Signal Handoff shell', async () => {
    const service = new RecordingNoticeService(
      config({
        WEB_ORIGIN: 'https://huddle.example',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-pass',
      }),
    );

    await service.actionRequired('ada@example.com');

    const [[message]] = sendMail.mock.calls as unknown as [[SentMessage]];
    expect(message.subject).toBe('Action needed: reconnect Google Drive for Huddle recordings');
    expect(message.text).toContain('Open recordings: https://huddle.example/recordings');
    expect(message.html).toContain('RECORDING DELIVERY');
    expect(message.html).toContain('Reconnect the delivery path.');
    expect(message.html).toContain('@media only screen and (max-width: 620px)');
  });

  it('sends the expiry notice through the same shell', async () => {
    const service = new RecordingNoticeService(config({ WEB_ORIGIN: 'https://huddle.example', SMTP_HOST: 'smtp.example.com' }));

    await service.expiryReminder('ada@example.com');

    const [[message]] = sendMail.mock.calls as unknown as [[SentMessage]];
    expect(message.subject).toBe('Recording local copy expires in 24 hours');
    expect(message.html).toContain('RECORDING RETENTION');
    expect(message.html).toContain('A recording needs a handoff.');
    expect(message.html).toContain('Open recordings');
  });
});
