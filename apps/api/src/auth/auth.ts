import { PrismaClient } from '@prisma/client';
import { SignJWT, importPKCS8 } from 'jose';

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

// Sign in with Apple wants a short-lived ES256 JWT as the "client secret",
// signed with the team's .p8 private key. Apple caps its lifetime at 6 months;
// we mint a fresh one each boot.
async function appleClientSecret(): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID!;
  const keyId = process.env.APPLE_KEY_ID!;
  const clientId = process.env.APPLE_CLIENT_ID!;
  // .env stores the key with escaped newlines; restore them for the PEM parser.
  const privateKeyPem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const key = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

async function build(): Promise<Auth> {
  const { betterAuth } = await import('better-auth');
  const { prismaAdapter } = await import('better-auth/adapters/prisma');

  const prisma = new PrismaClient();
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  // Only wire a provider when its credentials are present, so the API still
  // boots in a fresh checkout before OAuth apps are configured.
  const socialProviders: Record<string, unknown> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  ) {
    socialProviders.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: await appleClientSecret(),
      ...(process.env.APPLE_APP_BUNDLE_IDENTIFIER
        ? { appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER }
        : {}),
    };
  }

  if (Object.keys(socialProviders).length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] No social providers configured — set GOOGLE_* / APPLE_* in .env to enable login.',
    );
  }

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    // The web app runs on a different origin in dev; allow it so cookies and
    // OAuth redirects are accepted.
    trustedOrigins: [webOrigin, 'https://appleid.apple.com'],
    socialProviders,
  }) as unknown as Auth;
}
