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

export function getAuth(): Promise<Auth> {
  if (!authPromise) authPromise = build();
  return authPromise;
}

async function build(): Promise<Auth> {
  const { betterAuth } = await import('better-auth');
  const { prismaAdapter } = await import('better-auth/adapters/prisma');

  const prisma = new PrismaClient();
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  // Optional Google social login — only wired when credentials are present, so
  // the API still boots in a fresh checkout before an OAuth app is configured.
  const socialProviders: Record<string, unknown> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    // The web app runs on a different origin in dev; allow it so cookies are
    // accepted on cross-origin auth calls.
    trustedOrigins: [webOrigin],
    // Local email + password is the primary login; Google is optional.
    emailAndPassword: { enabled: true },
    socialProviders,
  }) as unknown as Auth;
}
