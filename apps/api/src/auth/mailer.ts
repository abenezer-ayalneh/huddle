import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

// Transactional email for auth flows. Today that's just the email-verification
// link BetterAuth asks us to deliver (see auth.ts → emailVerification). When
// SMTP credentials are present we send a real message; otherwise — a fresh
// checkout or local dev with no mail server — we log the link so verification
// still works end to end. This mirrors how Google login is "optional until
// configured": the API boots and verification functions either way.

const logger = new Logger('Mailer');

// BetterAuth hands us the full user + a verification URL; we only need these.
type VerificationEmail = { user: { email: string; name?: string | null }; url: string };

export function buildVerificationMailer(config: ConfigService) {
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  const host = config.get<string>('SMTP_HOST');
  const port = Number(config.get<string>('SMTP_PORT') ?? 587);
  const smtpUser = config.get<string>('SMTP_USER');
  const smtpPass = config.get<string>('SMTP_PASS');
  const from = config.get<string>('SMTP_FROM') ?? smtpUser ?? 'no-reply@huddle.local';

  // Built lazily on first send so an unconfigured API never opens a connection.
  let transport: nodemailer.Transporter | null = null;

  return async function sendVerificationEmail({ user, url }: VerificationEmail): Promise<void> {
    // BetterAuth builds the link with callbackURL=/ (the API origin). Rewrite it
    // to the web app so the user lands back on Huddle after verifying, not on a
    // bare API response.
    const link = new URL(url);
    link.searchParams.set('callbackURL', webOrigin);
    const verifyUrl = link.toString();

    if (!host) {
      logger.warn(`SMTP not configured — verification link for ${user.email}: ${verifyUrl}`);
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

    await transport.sendMail({
      from,
      to: user.email,
      subject: 'Verify your email for Huddle',
      text: `Welcome to Huddle!\n\nConfirm your email to finish setting up your account:\n${verifyUrl}\n\nIf you didn't create a Huddle account, you can ignore this message.`,
      html:
        `<p>Welcome to Huddle!</p>` +
        `<p>Confirm your email to finish setting up your account:</p>` +
        `<p><a href="${verifyUrl}">Verify my email</a></p>` +
        `<p>If you didn't create a Huddle account, you can ignore this message.</p>`,
    });
    logger.log(`Sent verification email to ${user.email}`);
  };
}
