import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Injection token for the shared ioredis client.
export const REDIS_CLIENT = 'REDIS_CLIENT';

// Global so any feature module (rooms knock state, health readiness) can inject
// the one shared connection without re-importing this module everywhere.
//
// Redis already runs in the stack for LiveKit; we reuse it for waiting-room
// knock state (survives an API restart + TTL self-expiry — see
// docs/adr/0005-knock-state-to-redis.md). REDIS_URL points at it
// (redis://localhost:6379 in dev, redis://redis:6379 in the compose network).
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        // REDIS_URL wins if set (prod compose); otherwise fall back to the
        // existing REDIS_HOST/REDIS_PORT convention from .env.example.
        const url =
          config.get<string>('REDIS_URL') ??
          `redis://${config.get<string>('REDIS_HOST') ?? 'localhost'}:${
            config.get<string>('REDIS_PORT') ?? '6379'
          }`;
        return new Redis(url, {
          // Don't crash the process on a transient Redis blip; ioredis retries.
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
