import { createAuthClient } from 'better-auth/react';

// BetterAuth client. It talks to the NestJS-mounted auth routes at
// ${AUTH_URL}/api/auth/*. The session cookie is set on the API origin; we send
// it on every API call with credentials: "include" (see lib/api.ts).
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
