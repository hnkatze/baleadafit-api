import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import { esSobre } from './codigos.js';
import { esPagina } from './paginacion.js';

/**
 * Envuelve toda respuesta del API en el sobre de éxito:
 *
 * - objeto o `null` → `{ ok: true, data: <lo mismo> }`
 * - lista paginada  → `{ ok: true, data: <filas>, meta: <paginación> }`
 *
 * No toca las respuestas sin cuerpo (204) ni las que ya vienen envueltas.
 */
@Injectable()
export class SobreInterceptor implements NestInterceptor {
  intercept(
    _contexto: ExecutionContext,
    siguiente: CallHandler,
  ): Observable<unknown> {
    return siguiente.handle().pipe(
      map((valor: unknown) => {
        if (valor === undefined || esSobre(valor)) return valor;
        if (esPagina(valor)) {
          return { ok: true, data: valor.items, meta: valor.meta };
        }
        return { ok: true, data: valor };
      }),
    );
  }
}
