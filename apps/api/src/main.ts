import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the web app's origin to call the API (see docs/API_CONTRACT.md).
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
