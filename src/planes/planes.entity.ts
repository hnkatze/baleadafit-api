/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';
import { AlimentoEntity } from '../alimentos/alimentos.entity.js';
import {
  EstadoPlan,
  OrigenPlan,
  TipoComida,
} from '../generated/prisma/enums.js';

export class TotalesEntity {
  /** @example 1436 */
  kcal: number;
  /** @example 105.9 */
  proteinaG: number;
  /** @example 161.3 */
  carbohidratoG: number;
  /** @example 45.7 */
  grasaG: number;
}

export class PlanItemEntity {
  id: string;
  tiempoComidaId: string;
  alimentoId: string;
  /**
   * Múltiplos de 0.25 de la porción del alimento.
   * @example 1.5
   */
  porciones: number;
  alimento: AlimentoEntity;
}

export class TiempoComidaEntity {
  id: string;
  planId: string;
  @ApiProperty({ enum: TipoComida, enumName: 'TipoComida' })
  tipo: TipoComida;
  /**
   * Fracción de las kcal del día.
   * @example 0.35
   */
  pctKcal: number;
  /** @example 2 */
  orden: number;
  items: PlanItemEntity[];
  /**
   * kcal objetivo de este tiempo de comida.
   * @example 500
   */
  kcalMeta: number;
  totales: TotalesEntity;
  /**
   * (real − meta) / meta.
   * @example 0.05
   */
  desviacion: number;
}

export class PlanEntity {
  id: string;
  pacienteId: string;
  nutricionistaId: string;
  /** @example "Plan inicial" */
  nombre: string;
  /** @example 1430 */
  kcalObjetivo: number;
  /** @example 89.4 */
  proteinaG: number;
  /** @example 178.8 */
  carbohidratoG: number;
  /** @example 39.7 */
  grasaG: number;
  @ApiProperty({ enum: EstadoPlan, enumName: 'EstadoPlan' })
  estado: EstadoPlan;
  @ApiProperty({ enum: OrigenPlan, enumName: 'OrigenPlan' })
  origen: OrigenPlan;
  /**
   * Resumen del recomendador o notas de la nutricionista.
   * @example "Plan con comida típica y porciones moderadas.\nPorciones verificadas por el sistema (±10 % de la meta). Revisar antes de aprobar."
   */
  justificacion: string | null;
  creadoEn: Date;
  aprobadoEn: Date | null;
}

export class PlanDetalleEntity extends PlanEntity {
  tiempos: TiempoComidaEntity[];
  /** Totales del día. */
  totales: TotalesEntity;
  /**
   * Desviación del día contra kcalObjetivo.
   * @example 0.004
   */
  desviacion: number;
}
