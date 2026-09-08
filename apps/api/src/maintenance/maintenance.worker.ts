import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LivekitService } from '../rooms/livekit.service';
import { RoomsService } from '../rooms/rooms.service';
import { RemoteControlService } from '../rooms/remote-control.service';
import { EgressService } from '../rooms/egress.service';
import { MAINTENANCE_LOCK } from './maintenance.service';

@Injectable()
export class MaintenanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly rooms: RoomsService,
    private readonly remoteControl: RemoteControlService,
    private readonly egress: EgressService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 1000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Same lock as changes: cancellation cannot race an older shutdown.
      // A transaction lock is released automatically if the process dies.
      await this.prisma.$transaction(
        async (tx) => {
          const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${MAINTENANCE_LOCK}) AS locked`;
          if (!lock?.locked) return;
          const state = await tx.maintenanceState.findUnique({ where: { id: 1 } });
          if (!state) return;
          const active = state.enabled && state.startsAt.getTime() <= Date.now();
          const rooms = await this.livekit.listActiveRooms();
          for (const room of rooms) {
            if (!active) {
              await this.livekit.publishMaintenance(room.name, {
                phase: state.enabled ? 'scheduled' : 'off',
                startsAt: state.enabled ? state.startsAt.toISOString() : null,
                message: state.message,
                serverTime: new Date().toISOString(),
              });
              continue;
            }
            // Persist before any external deletion: a crash after LiveKit ends
            // the room must not lose Redis/grant cleanup work. This uses a
            // separate committed write from the advisory-lock transaction.
            await this.prisma.maintenanceCleanup.upsert({
              where: { roomSid: room.sid },
              create: { roomSid: room.sid, roomName: room.name },
              update: {},
            });
            const recordings = await tx.recording.findMany({
              where: { room: { slug: room.name }, status: { in: ['starting', 'active'] } },
              select: { egressId: true },
            });
            for (const recording of recordings) {
              try {
                await this.egress.stop(recording.egressId);
              } catch (error) {
                this.logger.warn(`Recording stop will also follow room deletion: ${String(error)}`);
              }
            }
            try {
              await this.livekit.endRoom(room.name);
            } catch (error) {
              this.logger.warn(`Room termination will retry: ${String(error)}`);
            }
          }
          // Also runs after cancellation/reopening, but never touches a newer
          // call with the same Room Code. Reopening is blocked while this queue
          // remains, so old remote-control cleanup cannot end a new grant.
          const remaining = await this.livekit.listActiveRooms();
          const pending = await this.prisma.maintenanceCleanup.findMany();
          for (const item of pending) {
            if (remaining.some((room) => room.sid === item.roomSid)) continue;
            try {
              await this.remoteControl.onRoomFinished(item.roomName);
              await this.rooms.onRoomFinished(item.roomName, item.roomSid);
              await this.prisma.maintenanceCleanup.delete({ where: { roomSid: item.roomSid } });
            } catch (error) {
              this.logger.warn(`Maintenance cleanup will retry: ${String(error)}`);
            }
          }
        },
        { timeout: 60_000, maxWait: 1000 },
      );
    } catch (error) {
      this.logger.error('Maintenance sweep failed; it will retry', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
