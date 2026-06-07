import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

// BetterAuth is ESM-only and NestJS compiles to CommonJS, so we load it through
// a dynamic import() (legal from CJS) and build the instance once, lazily. The
// rest of the app reaches the instance via getAuth(). The auth HTTP routes are
// mounted in main.ts with better-auth's toNodeHandler; guards read the session
// with auth.api.getSession (see auth.guard.ts).

// `Auth` is the better-auth instance type. We only need it for typing, so a
// structural alias avoids a value import of the ESM module.
export type Auth = {
  handler: (req: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      user: { id: string; name: string; email: string; image?: string | null };
    } | null>;
  };
};

let authPromise: Promise<Auth> | null = null;

// Memoised, so only the first caller's ConfigService is used to build it;
// callers all pass the same global ConfigService instance.
export function getAuth(config: ConfigService): Promise<Auth> {
  if (!authPromise) authPromise = build(config);
  return authPromise;
}

async function build(config: ConfigService): Promise<Auth> {
  const { betterAuth } = await import('better-auth');
  const { prismaAdapter } = await import('better-auth/adapters/prisma');

  const prisma = new PrismaClient();
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';

  // Optional Google social login — only wired when credentials are present, so
  // the API still boots in a fresh checkout before an OAuth app is configured.
  const socialProviders: Record<string, unknown> = {};
  const googleClientId = config.get<string>('GOOGLE_CLIENT_ID');
  const googleClientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: config.get<string>('BETTER_AUTH_SECRET'),
    baseURL: config.get<string>('BETTER_AUTH_URL') ?? 'http://localhost:3001',
    // The web app runs on a different origin in dev; allow it so cookies are
    // accepted on cross-origin auth calls.
    trustedOrigins: [webOrigin],
    // Local email + password is the primary login; Google is optional.
    emailAndPassword: { enabled: true },
    socialProviders,
  });
}
