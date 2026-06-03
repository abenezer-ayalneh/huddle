import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify LiveKit webhook signatures (raw bytes).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Validate and strip request bodies; reject unknown fields so the client
  // can never smuggle in grant fields (see docs/API_CONTRACT.md).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allow the web app's origin to call the API (see docs/API_CONTRACT.md).
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
}
void bootstrap();
