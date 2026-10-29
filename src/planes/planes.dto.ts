import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Fracción de las kcal para cada macronutriente; debe sumar 1. */
export class DistribucionMacrosDto {
  /** @example 0.3 */
  @IsNumber()
  @Min(0.1)
  @Max(0.5)
  proteina: number;

  /** @example 0.45 */
  @IsNumber()
  @Min(0.2)
  @Max(0.7)
  carbohidrato: number;

  /** @example 0.25 */
  @IsNumber()
  @Min(0.1)
  @Max(0.5)
  grasa: number;
}

/** Fracción de las kcal del día por tiempo de comida; debe sumar 1. Un tiempo ausente o en 0 no se incluye. */
export class DistribucionTiemposDto {
  /** @example 0.3 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  DESAYUNO?: number;

  /** @example 0 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  MERIENDA_AM?: number;

  /** @example 0.4 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ALMUERZO?: number;

  /** @example 0.1 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  MERIENDA_PM?: number;

  /** @example 0.2 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  CENA?: number;
}

export class GenerarPlanDto {
  /**
   * Por defecto "Plan YYYY-MM-DD".
   * @example "Plan inicial"
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  /**
   * true (por defecto): Bedrock propone y el backend valida. false: solo reglas.
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  usarIa?: boolean;

  /**
   * Sobrescribe las kcal calculadas con Mifflin-St Jeor.
   * @example 1600
   */
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(5000)
  kcalObjetivo?: number;

  /** Por defecto 25 % proteína, 50 % carbohidratos, 25 % grasa. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DistribucionMacrosDto)
  distribucionMacros?: DistribucionMacrosDto;

  /** Por defecto desayuno 25 %, merienda AM 10 %, almuerzo 35 %, merienda PM 10 %, cena 20 %. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DistribucionTiemposDto)
  distribucionTiempos?: DistribucionTiemposDto;

  /**
   * Indicaciones para la IA.
   * @example "Prefiere desayunos rápidos y cenas sin frituras."
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  indicaciones?: string;
}

export class ActualizarPlanDto {
  /** @example "Plan noviembre" */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  /** @example 1500 */
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(5000)
  kcalObjetivo?: number;

  /** @example 95 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  proteinaG?: number;

  /** @example 180 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbohidratoG?: number;

  /** @example 45 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  grasaG?: number;

  /** @example "Ajustado por preferencia del paciente." */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  justificacion?: string;
}

export class ItemPlanDto {
  /** ID de `GET /alimentos`. */
  @IsUUID()
  alimentoId: string;

  /**
   * Cantidad de porciones del alimento (múltiplos de 0.25 recomendados).
   * @example 1.5
   */
  @IsNumber()
  @Min(0.25)
  @Max(6)
  porciones: number;
}

export class ReemplazarItemsDto {
  /** Lista completa de alimentos del tiempo de comida (máximo 12). */
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ItemPlanDto)
  items: ItemPlanDto[];
}
