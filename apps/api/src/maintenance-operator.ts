import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { AppModule } from './app.module';
import { MaintenanceService } from './maintenance/maintenance.service';
import { MaintenanceWorker } from './maintenance/maintenance.worker';
import { LivekitService } from './rooms/livekit.service';
import { PrismaService } from './prisma/prisma.service';

async function main() {
  const command = process.argv[2];
  if (!['on', 'off', 'status', 'owner'].includes(command)) throw new Error('Usage: maintenance-operator.js on|off|status|owner [email]');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const maintenance = app.get(MaintenanceService);
    const prisma = app.get(PrismaService);
    if (command === 'owner') {
      const email = process.argv[3];
      if (!email) throw new Error('Provide the owner email to verify');
      const matches = await prisma.user.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, emailVerified: true },
      });
      if (matches.length !== 1 || !matches[0].emailVerified) throw new Error('Expected exactly one verified account; owner configuration was not changed');
      process.stdout.write(`${JSON.stringify(matches[0])}\n`);
      return;
    }
    if (command === 'status') {
      process.stdout.write(`${JSON.stringify(await maintenance.status())}\n`);
      return;
    }
    const ownerId = app.get(ConfigService).get<string>('MAINTENANCE_OWNER_USER_ID');
    const owner = ownerId ? await prisma.user.findUnique({ where: { id: ownerId } }) : null;
    if (!owner?.emailVerified) throw new Error('Configure a verified owner account before changing maintenance');
    const state = await maintenance.change(command === 'on', undefined, owner.id);
    process.stdout.write(`${JSON.stringify(state)}\n`);
    if (command === 'off') return;
    // Keep this process alive: it publishes the warning through LiveKit even
    // when the HTTP API is stopped, then runs the same cleanup worker.
    const deadline = Date.parse(state.startsAt!);
    while (Date.now() < deadline) {
      await delay(1000);
      if ((await maintenance.status()).phase === 'off') throw new Error('Maintenance was cancelled; static override was not enabled');
    }
    const cleanupTimeout = Date.now() + 120_000;
    while (Date.now() < cleanupTimeout) {
      if ((await maintenance.status()).phase === 'off') throw new Error('Maintenance was cancelled; static override was not enabled');
      await app.get(MaintenanceWorker).tick();
      if ((await app.get(LivekitService).listActiveRooms()).length === 0 && (await prisma.maintenanceCleanup.count()) === 0) {
        process.stdout.write('Meetings ended. Ready for the static override.\n');
        return;
      }
      await delay(1000);
    }
    throw new Error('Could not verify all meetings ended. Maintenance stays enabled; retry on to finish cleanup.');
  } finally {
    await app.close();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
