import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarSwagger } from './common/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origenes = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes?.length ? origenes : true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  configurarSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
