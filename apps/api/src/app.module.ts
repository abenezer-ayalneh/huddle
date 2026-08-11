import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';
import { validateEnvironment } from './config/validate-env';

@Module({
  imports: [
    SentryModule.forRoot(),
    // Load the repo-root .env (single source of truth — see
    // docs/adr/0001-livekit-secret-single-source.md).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '..', '.env'),
      expandVariables: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    RoomsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
