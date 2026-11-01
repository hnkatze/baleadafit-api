import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp } from './common/configurar-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origenes = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes?.length ? origenes : true });

  configurarApp(app);

  const puerto = process.env.PORT ?? 3000;
  // 0.0.0.0 explícito: el proxy de Railway llega por IPv4 a la red interna del
  // contenedor, y sin host Node escucha en `::`, que en algunos contenedores
  // queda aislado de IPv4 y el dominio responde 502 "Application failed to respond".
  await app.listen(puerto, '0.0.0.0');
  Logger.log(`Escuchando en 0.0.0.0:${puerto}`, 'Bootstrap');
}
await bootstrap();
