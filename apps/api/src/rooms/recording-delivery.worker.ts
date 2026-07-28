import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordingDeliveryService } from './recording-delivery.service';

@Injectable()
export class RecordingDeliveryWorker {
  private readonly logger = new Logger(RecordingDeliveryWorker.name);
  private readonly pollMs: number;

  constructor(
    private readonly delivery: RecordingDeliveryService,
    config: ConfigService,
  ) {
    const configured = Number(config.get<string>('RECORDING_WORKER_POLL_MS') ?? 30_000);
    this.pollMs = Number.isFinite(configured) && configured >= 1_000 ? configured : 30_000;
  }

  async runForever(): Promise<void> {
    for (;;) {
      try {
        await this.delivery.runCycle();
      } catch (error) {
        this.logger.error(`Recording delivery worker cycle failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, this.pollMs));
    }
  }
}
