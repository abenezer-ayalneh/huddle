import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RecordingDeliveryService } from './rooms/recording-delivery.service';

async function preview() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const result = await app.get(RecordingDeliveryService).retentionPreview();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}
void preview().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
