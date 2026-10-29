/* Modelo de respuesta para la documentación de Swagger (no se instancia). */
import { ApiProperty } from '@nestjs/swagger';
import { CategoriaAlimento, TipoComida } from '../generated/prisma/enums.js';

export class AlimentoEntity {
  id: string;
  /** @example "Baleada sencilla" */
  nombre: string;
  @ApiProperty({ enum: CategoriaAlimento, enumName: 'CategoriaAlimento' })
  categoria: CategoriaAlimento;
  /** @example "1 unidad" */
  porcionDescripcion: string;
  /** @example 120 */
  porcionGramos: number;
  /**
   * Por porción.
   * @example 330
   */
  kcal: number;
  /** @example 11 */
  proteinaG: number;
  /** @example 42 */
  carbohidratoG: number;
  /** @example 13 */
  grasaG: number;
  fibraG: number | null;
  @ApiProperty({ enum: TipoComida, enumName: 'TipoComida', isArray: true })
  tiposComida: TipoComida[];
  /**
   * Etiquetas para filtrar restricciones.
   * @example ["gluten", "lactosa"]
   */
  contiene: string[];
  /** @example true */
  esTipicoHn: boolean;
  /** @example "Aproximado — verificar con Tabla de Composición de Alimentos INCAP" */
  fuente: string | null;
  activo: boolean;
}
