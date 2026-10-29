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

/** Historial de valores de un alimento: una fila por revisión de la tabla. */
export class AlimentoVersionEntity {
  /** Consecutivo por alimento. @example 2 */
  version: number;
  /** Revisión de la tabla usada. @example "INCAP 2026" */
  tabla: string;
  fuente: string | null;
  @ApiProperty({ type: String, format: 'date', example: '2026-10-29' })
  vigenteDesde: Date;
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Nulo en la versión vigente.',
    example: null,
  })
  vigenteHasta: Date | null;
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
  sodioMg: number | null;
  potasioMg: number | null;
  fosforoMg: number | null;
  azucaresG: number | null;
  grasasSatG: number | null;
  indiceGlucemico: number | null;
}
