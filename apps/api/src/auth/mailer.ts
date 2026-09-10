import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { buildSignalHandoffEmail } from '../common/signal-handoff-email';

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
  const formatDetail = (value: unknown): string => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  };

  if (details.code) parts.push(`code=${formatDetail(details.code)}`);
  if (details.command) parts.push(`command=${formatDetail(details.command)}`);
  if (details.responseCode) parts.push(`responseCode=${formatDetail(details.responseCode)}`);
  if (details.response) parts.push(`response=${formatDetail(details.response)}`);

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
  return buildSignalHandoffEmail({
    preheader: 'Confirm your email to complete your Huddle account handoff.',
    route: 'ACCOUNT HANDOFF',
    title: 'Confirm this address.',
    body: 'Welcome to Huddle. Confirm this address to complete your account handoff and start hosting or joining meetings.',
    action: { href: verifyUrl, label: 'Verify email' },
    fallbackLabel: 'If the button does not work, copy and paste this link into your browser:',
    note: "If you didn't create a Huddle account, you can safely ignore this message.",
  });
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
