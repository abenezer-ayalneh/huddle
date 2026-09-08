import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export const WARNING_MS = 5 * 60 * 1000;
export const MAINTENANCE_LOCK = 714205;
export const DEFAULT_MESSAGE = 'Huddle is temporarily unavailable while we make improvements. Please check back shortly.';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async status() {
    const state = await this.prisma.maintenanceState.findUnique({ where: { id: 1 } });
    const now = Date.now();
    return {
      phase: !state?.enabled ? 'off' : state.startsAt.getTime() > now ? 'scheduled' : 'active',
      startsAt: state?.enabled ? state.startsAt.toISOString() : null,
      message: state?.message || DEFAULT_MESSAGE,
      serverTime: new Date(now).toISOString(),
    };
  }

  isOwner(userId?: string) {
    const owner = this.config.get<string>('MAINTENANCE_OWNER_USER_ID')?.trim();
    return Boolean(owner && userId && owner === userId);
  }

  requireOwner(userId?: string) {
    if (!this.isOwner(userId)) throw new ForbiddenException('Only the site owner can manage maintenance');
  }

  async change(enabled: boolean, message: string | undefined, actorId: string) {
    this.requireOwner(actorId);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MAINTENANCE_LOCK})`;
        if (!enabled && (await tx.maintenanceCleanup.count()) > 0) {
          throw new ConflictException('Meeting cleanup is still running. Try reopening shortly.');
        }
        const previous = await tx.maintenanceState.findUnique({ where: { id: 1 } });
        // Retrying Enable cannot extend the warning or reset an active shutdown.
        const startsAt = previous?.enabled && enabled ? previous.startsAt : new Date(Date.now() + WARNING_MS);
        await tx.maintenanceState.upsert({
          where: { id: 1 },
          create: { id: 1, enabled, startsAt, message: message?.trim() || DEFAULT_MESSAGE, actorId },
          update: { enabled, startsAt, message: message?.trim() || DEFAULT_MESSAGE, actorId },
        });
      },
      { timeout: 65_000 },
    );
    return this.status();
  }

  async requireAdmissionsOpen() {
    if ((await this.status()).phase !== 'off') {
      throw new ServiceUnavailableException({ code: 'MAINTENANCE', message: 'Huddle is preparing for maintenance. New meetings and joins are paused.' });
    }
  }
}
