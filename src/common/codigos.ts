/**
 * Contrato del sobre de respuesta, compartido por el interceptor, el filtro de
 * excepciones y el motor de paginación.
 *
 * Vive aparte de `respuesta.ts` (que agrega los decoradores de Swagger) para que
 * `paginacion.ts` pueda usar los códigos sin ciclo de imports.
 */

/**
 * Códigos estables de error. El cliente decide con esto y no parsea mensajes:
 * los textos pueden cambiar, el código no.
 */
export const CODIGOS = {
  VALIDACION: 'VALIDACION',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  SIN_PERMISO: 'SIN_PERMISO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  CONFLICTO: 'CONFLICTO',
  CURSOR_INVALIDO: 'CURSOR_INVALIDO',
  ERROR_HTTP: 'ERROR_HTTP',
  ERROR_INTERNO: 'ERROR_INTERNO',
} as const;

export type CodigoFalla = (typeof CODIGOS)[keyof typeof CODIGOS];

/** Cuerpo del `error` de una respuesta fallida. */
export interface DetalleFalla {
  codigo: CodigoFalla;
  mensaje: string;
  /** Errores por campo, cuando el fallo es de validación. */
  detalles?: string[];
}

/** Éxito. `data` es exactamente lo que el endpoint devolvía antes del sobre. */
export interface SobreOk<T> {
  ok: true;
  data: T;
}

/** Fallo. El status HTTP se conserva; `codigo` lo dice sin ambigüedad. */
export interface SobreFalla {
  ok: false;
  error: DetalleFalla;
}

/**
 * Si el valor ya es un sobre no se vuelve a envolver. El interceptor lo consulta
 * para ser idempotente y para dejar pasar respuestas armadas a mano.
 */
export const esSobre = (valor: unknown): valor is SobreOk<unknown> | SobreFalla =>
  typeof valor === 'object' &&
  valor !== null &&
  'ok' in valor &&
  typeof (valor as { ok: unknown }).ok === 'boolean';
