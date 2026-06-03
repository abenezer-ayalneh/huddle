import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RoomStateService } from './rooms.state';

// Authorizes host-only endpoints: the `x-host-key` header must match the
// room's host key. The room name is taken from the `:room` route param.
@Injectable()
export class HostGuard implements CanActivate {
  constructor(private readonly state: RoomStateService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const room = String(req.params.room);
    const headerVal = req.headers['x-host-key'];
    const hostKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    if (!this.state.isHost(room, hostKey)) {
      throw new UnauthorizedException('Not the host of this room');
    }
    return true;
  }
}
