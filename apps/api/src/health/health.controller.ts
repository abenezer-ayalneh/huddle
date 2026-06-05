import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Liveness probe — the process is up and serving. Cheap and dependency-free
  // so a load balancer / orchestrator restarts only a truly dead process.
  // See docs/API_CONTRACT.md (GET /health).
  @Get('health')
  check(): { status: string } {
    return { status: 'ok' };
  }

  // Readiness probe — the process can actually serve traffic, i.e. its backing
  // stores answer. Used to gate a node in/out of rotation. 503 if either the
  // database or Redis is unreachable. See docs/API_CONTRACT.md (GET /ready).
  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    const [db, cache] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`
        .then(() => 'ok')
        .catch((err: unknown) => this.fail('postgres', err)),
      this.redis
        .ping()
        .then(() => 'ok')
        .catch((err: unknown) => this.fail('redis', err)),
    ]);

    const checks = { postgres: db, redis: cache };
    if (db !== 'ok' || cache !== 'ok') {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ok', checks };
  }

  private fail(dep: string, err: unknown): string {
    this.logger.warn(`readiness check failed for ${dep}: ${String(err)}`);
    return 'down';
  }
}
