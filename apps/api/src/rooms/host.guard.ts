import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { RoomRepository } from './rooms.repo';

// Authorizes host-only endpoints: the `x-host-key` header must match the
// room's persisted host key. The room slug is taken from the `:room` route
// param. This is independent of the BetterAuth session — the host key is the
// per-room capability handed out at create time.
@Injectable()
export class HostGuard implements CanActivate {
  constructor(private readonly rooms: RoomRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const slug = String(req.params.room);
    const headerVal = req.headers['x-host-key'];
    const hostKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    const room = await this.rooms.findBySlug(slug);
    if (!room || !hostKey || room.hostKey !== hostKey) {
      throw new UnauthorizedException('Not the host of this room');
    }
    return true;
  }
}
