import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

// Transactional email for auth flows. Today that's just the email-verification
// link BetterAuth asks us to deliver (see auth.ts → emailVerification). When
// SMTP credentials are present we send a real message; otherwise we do nothing.
// We never log the link: a verification URL is a bearer credential (clicking it
// confirms the account), so it must not sit in logs. A send that fails must not
// break the signup flow, but we do log sanitized SMTP diagnostics so production
// can distinguish bad env, provider rejection, and deliverability issues.

const logger = new Logger('Mailer');

// BetterAuth hands us the full user + a verification URL; we only need these.
type VerificationEmail = { user: { email: string; name?: string | null }; url: string };
type MailerConfig = Pick<ConfigService, 'get'>;

function describeMailerError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = error as Error & {
    code?: unknown;
    command?: unknown;
    responseCode?: unknown;
    response?: unknown;
  };
  const parts = [error.message];

  if (details.code) parts.push(`code=${String(details.code)}`);
  if (details.command) parts.push(`command=${String(details.command)}`);
  if (details.responseCode) parts.push(`responseCode=${String(details.responseCode)}`);
  if (details.response) parts.push(`response=${String(details.response)}`);

  return parts.join(' ');
}

function buildWebVerificationUrl(url: string, webOrigin: string): string {
  const link = new URL(url);
  const verifyUrl = new URL('/verify-email', webOrigin);
  const token = link.searchParams.get('token');
  if (token) verifyUrl.searchParams.set('token', token);
  return verifyUrl.toString();
}

function buildVerificationMessage(verifyUrl: string): { text: string; html: string } {
  return {
    text:
      `Welcome to Huddle!\n\n` +
      `Confirm your email to finish setting up your account:\n${verifyUrl}\n\n` +
      `If you didn't create a Huddle account, you can ignore this message.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#142033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5edf6;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 10px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:36px;height:36px;border-radius:12px;background:#111827;text-align:center;vertical-align:middle;">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#d946a8;margin:0 2px 8px 0;"></span>
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#5ce0d6;margin:0 0 8px 2px;"></span><br>
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#5ce0d6;margin:0 2px 0 0;"></span>
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#d946a8;margin:0 0 0 2px;"></span>
                    </td>
                    <td style="padding-left:12px;font-size:24px;font-weight:700;color:#111827;">Huddle</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 8px;">
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#111827;">Verify your email</h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#4b5870;">
                  Welcome to Huddle. Confirm this address to finish setting up your account and start hosting meetings.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 26px;">
                <a href="${verifyUrl}" style="display:inline-block;border-radius:10px;background:#d946a8;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:13px 20px;">Verify my email</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#69758a;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${verifyUrl}" style="color:#0b7f86;">${verifyUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fbff;padding:18px 32px;border-top:1px solid #e5edf6;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#7a8599;">If you did not create a Huddle account, you can safely ignore this message.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

export function buildVerificationMailer(config: MailerConfig) {
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  const host = config.get<string>('SMTP_HOST');
  const port = Number(config.get<string>('SMTP_PORT') ?? 587);
  const smtpUser = config.get<string>('SMTP_USER');
  const smtpPass = config.get<string>('SMTP_PASS');
  const from = config.get<string>('SMTP_FROM') ?? smtpUser ?? 'no-reply@huddle.local';

  // Built lazily on first send so an unconfigured API never opens a connection.
  let transport: nodemailer.Transporter | null = null;

  return async function sendVerificationEmail({ user, url }: VerificationEmail): Promise<void> {
    // BetterAuth builds an API verification link. Wrap its token in a web route
    // so the user sees Huddle's verifying screen before the page calls the API.
    const verifyUrl = buildWebVerificationUrl(url, webOrigin);

    // No SMTP configured → nothing to send. We deliberately do not log the link.
    if (!host) {
      return;
    }

    if (!transport) {
      transport = nodemailer.createTransport({
        host,
        port,
        // Implicit TLS on 465; STARTTLS (upgraded) on 587/25.
        secure: port === 465,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      });
    }

    try {
      const message = buildVerificationMessage(verifyUrl);
      await transport.sendMail({
        from: { name: 'Huddle', address: from },
        to: user.email,
        subject: 'Verify your email for Huddle',
        text: message.text,
        html: message.html,
      });
      logger.log(`Sent verification email to ${user.email}`);
    } catch (error) {
      // A send failure must not break signup, and the verification URL must
      // never be logged. Keep enough SMTP context to debug prod wiring.
      logger.warn(`Failed to send verification email to ${user.email} via ${host}:${port} from ${from}: ${describeMailerError(error)}`);
    }
  };
}
