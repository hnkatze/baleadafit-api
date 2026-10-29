/**
 * Exporta la especificación OpenAPI a docs/openapi.json sin levantar el servidor.
 * Uso: npm run openapi (requiere `npm run build` porque el plugin de Swagger
 * agrega los metadatos al compilar).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { crearDocumentoOpenApi } from './common/swagger.js';

process.env.DATABASE_URL ??=
  'postgresql://openapi:openapi@localhost:5432/openapi';

const app = await NestFactory.create(AppModule, { logger: false });
const documento = crearDocumentoOpenApi(app);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/openapi.json', `${JSON.stringify(documento, null, 2)}\n`);
await app.close();
console.log(`docs/openapi.json: ${Object.keys(documento.paths).length} rutas`);
