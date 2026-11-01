import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Cuántas filas devuelve una lista si el cliente no pide otra cosa. */
export const LIMITE_POR_DEFECTO = 20;
/** Techo duro: por encima de esto la respuesta deja de ser paginable. */
export const LIMITE_MAXIMO = 100;

/**
 * Parámetros de paginación comunes a todas las listas.
 *
 * - `?offset=&limit=` → modo web: la respuesta trae `total` y `hasMore`.
 * - `?cursor=&limit=` → modo mobile: la respuesta trae `nextCursor` y `hasMore`,
 *   sin `COUNT`, y sigue desde la última fila que el cliente ya tiene.
 *
 * Nunca los dos: combinar `offset` con `cursor` responde 400.
 */
export class PaginacionDto {
  /**
   * Filas por página. Por defecto 20, máximo 100.
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit?: number;

  /**
   * Filas a saltear (modo web, base 0). La primera página es `offset=0`.
   * @example 0
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /**
   * Cursor opaco de la página anterior (modo mobile): es el `nextCursor` que
   * devolvió la llamada previa. No se puede inventar ni mezclar entre listas.
   * @example "ZjQ3ZmYxYzIt"
   */
  @IsOptional()
  @IsString()
  cursor?: string;
}
