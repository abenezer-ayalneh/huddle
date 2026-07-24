import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { buildVerificationMailer } from './mailer';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

type ConfigValues = Partial<Record<string, string>>;

function config(values: ConfigValues): Pick<ConfigService, 'get'> {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

describe('buildVerificationMailer', () => {
  const createTransport = nodemailer.createTransport as jest.Mock;
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    createTransport.mockReset();
    createTransport.mockReturnValue({ sendMail });
  });

  it('sends a branded verification email that opens the Huddle verification page', async () => {
    const mailer = buildVerificationMailer(
      config({
        WEB_ORIGIN: 'https://huddle.example',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-pass',
        SMTP_FROM: 'hello@example.com',
      }),
    );

    await mailer({
      user: { email: 'ada@example.com', name: 'Ada' },
      url: 'https://api.example/api/auth/verify-email?token=abc.def.ghi&callbackURL=%2F',
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);

    const [[firstMessage]] = sendMail.mock.calls as unknown as [[unknown]];
    const message = firstMessage as {
      from: unknown;
      to: string;
      subject: string;
      text: string;
      html: string;
    };

    expect(message.from).toEqual({ name: 'Huddle', address: 'hello@example.com' });
    expect(message.to).toBe('ada@example.com');
    expect(message.subject).toBe('Verify your email for Huddle');
    expect(message.text).toContain('https://huddle.example/verify-email?token=abc.def.ghi');
    expect(message.text).toContain("If you didn't create a Huddle account");
    expect(message.html).toContain('Verify my email');
    expect(message.html).toContain('https://huddle.example/verify-email?token=abc.def.ghi');
    expect(message.html).not.toContain('callbackURL');
  });

  it('does not create a transport or send when SMTP is not configured', async () => {
    const mailer = buildVerificationMailer(config({ WEB_ORIGIN: 'https://huddle.example' }));

    await mailer({
      user: { email: 'ada@example.com' },
      url: 'https://api.example/api/auth/verify-email?token=abc.def.ghi',
    });

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
