import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';
import { AppModule } from './app.module';
import { getAuth } from './auth/auth';

async function bootstrap() {
  // We do our own body parsing below so we can (a) hand BetterAuth the raw
  // request stream on its routes and (b) keep the raw bytes for LiveKit webhook
  // signature verification on ours.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // CORS must be registered FIRST so it handles the preflight OPTIONS (and adds
  // headers) before our auth middleware terminates the response. credentials:true
  // so the BetterAuth session cookie is sent on cross-origin fetches.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // Mount BetterAuth's handler on /api/auth/* (login, callbacks, session). It
  // must read the raw body itself, so it runs *before* express.json(). Loaded
  // via dynamic import because better-auth is ESM-only (see auth/auth.ts).
  const auth = await getAuth();
  const { toNodeHandler } = await import('better-auth/node');
  const authHandler = toNodeHandler(auth);

  // JSON parser for our own routes; capture the raw bytes for the webhook.
  // LiveKit sends webhooks as `application/webhook+json`, so we must accept that
  // type too — otherwise the body isn't parsed, the `verify` hook never runs,
  // `rawBody` stays empty, and the webhook signature check fails (sha256 of an
  // empty body never matches). The raw bytes are required to verify the signature.
  const jsonParser = json({
    type: ['application/json', 'application/webhook+json'],
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith('/api/auth')) {
      void authHandler(req, res);
      return;
    }
    jsonParser(req, res, next);
  });

  // Validate and strip request bodies; reject unknown fields so the client
  // can never smuggle in grant fields (see docs/API_CONTRACT.md).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
