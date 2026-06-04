import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type { Request } from 'express';
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
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: toHeaders(req.headers),
    });
    if (!session) {
      throw new UnauthorizedException('Sign in required');
    }
    req.user = session.user;
    return true;
  }
}

// Injects the signed-in user resolved by AuthGuard into a controller handler.
export const SessionUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    return req.user as AuthUser;
  },
);
