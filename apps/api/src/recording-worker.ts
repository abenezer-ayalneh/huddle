import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RecordingDeliveryWorker } from './rooms/recording-delivery.worker';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.get(RecordingDeliveryWorker).runForever();
}
void bootstrap().catch((error: unknown) => {
  // Never print OAuth values or resumable URLs; worker services sanitize their
  // operational errors before logging them.
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
