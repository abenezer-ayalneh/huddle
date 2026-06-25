import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'node:http';
import type { Request } from 'express';
import { FaultCode, faultBody } from '../common/faults';
import { getAuth } from './auth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

type RequestWithUser = Request & { user?: AuthUser };

// Convert Node's header bag into the web Headers the better-auth API expects.
function toHeaders(headers: IncomingHttpHeaders): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) value.forEach((v) => out.append(key, v));
    else if (value != null) out.set(key, value);
  }
  return out;
}

// Protects a route: requires a valid BetterAuth session and attaches the user
// to the request. Authority for *host* actions still rides the per-room
// x-host-key (HostGuard) — this guard is only about "is someone signed in".
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const auth = await getAuth(this.config);
    const session = await auth.api.getSession({
      headers: toHeaders(req.headers),
    });
    if (!session) {
      throw new UnauthorizedException(faultBody(FaultCode.SESSION_EXPIRED, 'Sign in required'));
    }
    req.user = session.user;
    return true;
  }
}

// Injects the signed-in user resolved by AuthGuard into a controller handler.
export const SessionUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const req = context.switchToHttp().getRequest<RequestWithUser>();
  return req.user as AuthUser;
});

// Like AuthGuard but never rejects: it attaches the user when a valid session is
// present and otherwise lets the request through anonymously. Use it on public
// routes that want to recognise a signed-in caller without forcing sign-in — e.g.
// the knock route, where a signed-in guest's name comes from their session but an
// anonymous guest must still be able to knock (docs/adr/0016).
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    try {
      const auth = await getAuth(this.config);
      const session = await auth.api.getSession({
        headers: toHeaders(req.headers),
      });
      if (session) req.user = session.user;
    } catch {
      // Anonymous proceeds — a failed session lookup must not block a public route.
    }
    return true;
  }
}

// Injects the optionally-resolved user (or null) for a route guarded by
// OptionalAuthGuard.
export const OptionalSessionUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser | null => {
  const req = context.switchToHttp().getRequest<RequestWithUser>();
  return req.user ?? null;
});
