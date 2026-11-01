import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { FiltroExcepciones } from './excepciones.filter.js';
import { SobreInterceptor } from './respuesta.interceptor.js';
import { configurarSwagger } from './swagger.js';

/**
 * Toda la configuración de la aplicación en un solo lugar.
 *
 * `main.ts` y el e2e llaman a esta misma función: si el e2e armara la app por su
 * cuenta, probaría una app distinta de la que corre en producción (sin el sobre,
 * sin el filtro o con otras validaciones) y los tests mentirían.
 */
export function configurarApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new SobreInterceptor());
  app.useGlobalFilters(new FiltroExcepciones());
  configurarSwagger(app);
}
