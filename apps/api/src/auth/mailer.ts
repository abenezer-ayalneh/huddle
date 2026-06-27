import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

// Transactional email for auth flows. Today that's just the email-verification
// link BetterAuth asks us to deliver (see auth.ts → emailVerification). When
// SMTP credentials are present we send a real message; otherwise we do nothing.
// We never log the link: a verification URL is a bearer credential (clicking it
// confirms the account), so it must not sit in logs. A send that fails fails
// silently — it must not break the signup flow. The consequence is that without
// working SMTP, email verification simply cannot complete (use Brevo dashboard
// logs, not app logs, to confirm delivery in prod).

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
    } catch {
      // Fail silently: a send failure must not break the signup flow, and we
      // never log the link. Confirm delivery via the SMTP provider's dashboard.
    }
  };
}
