import * as Sentry from '@sentry/nestjs';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { scrubSentryBreadcrumb, scrubSentryEvent } from './observability/sentry-privacy';

// Sentry must initialize before NestJS, which is earlier than ConfigModule can
// load the repo-root .env in local development. Real process/container
// variables win; this only fills values that are not already present.
loadEnv({
  path: join(__dirname, '..', '..', '..', '.env'),
  override: false,
  quiet: true,
});

const dsn = process.env.SENTRY_API_DSN;

// This module is imported before NestJS and every instrumented dependency in
// main.ts. With no DSN the SDK stays disabled, so local development and tests
// do not emit events accidentally.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
});
