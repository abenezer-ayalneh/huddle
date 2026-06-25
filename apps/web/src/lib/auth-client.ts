import { createAuthClient } from 'better-auth/react';
import { NET_UNREACHABLE } from './faultCodes';
import { emitFault } from './faults';
import { httpFetch, isFaultError } from './http';

// BetterAuth client. It talks to the NestJS-mounted auth routes at
// ${AUTH_URL}/api/auth/*. The session cookie is set on the API origin; we send
// it on every API call with credentials: "include" (see lib/api.ts).
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    // Route BetterAuth's own fetch through the shared chokepoint (docs/adr/0019)
    // so a dropped connection on, e.g., the on-focus get-session refetch tracks
    // API Reachability (the quiet banner) instead of escaping as an uncaught
    // `TypeError: Failed to fetch`. These calls are passive by default — no
    // surfaceFault flag — so background failures never raise a toast.
    customFetchImpl: (input, init) => httpFetch(typeof input === 'string' ? input : input.toString(), (init ?? {}) as RequestInit),
  },
});

export const { signOut, useSession } = authClient;

// Active wrappers: sign-in / sign-up are user-initiated, so a connectivity
// failure on them is loud — the Fault toast, not just the banner (docs/adr/0019).
// BetterAuth swallows the transport FaultError into its result or rejects;
// either way we surface a NET fault. Credential errors (wrong password) come
// back as a normal { error } result and stay inline at the call site — those are
// Domain Outcomes, not Faults.
type AuthResult = { error?: { status?: number; message?: string } | null };

async function active<T extends AuthResult>(run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    if (result?.error && isConnectivityError(result.error)) {
      emitFault({ code: NET_UNREACHABLE, message: "Can't reach the server. It may be offline.", statusCode: 0 });
    }
    return result;
  } catch (e) {
    if (isFaultError(e)) emitFault(e.fault);
    throw e;
  }
}

function isConnectivityError(error: { status?: number; message?: string }): boolean {
  return error.status === 0 || /failed to fetch|reach the server|network/i.test(error.message ?? '');
}

export const signIn = {
  email: (args: Parameters<typeof authClient.signIn.email>[0]) => active(() => authClient.signIn.email(args)),
  social: (args: Parameters<typeof authClient.signIn.social>[0]) => active(() => authClient.signIn.social(args)),
};

export const signUp = {
  email: (args: Parameters<typeof authClient.signUp.email>[0]) => active(() => authClient.signUp.email(args)),
};
