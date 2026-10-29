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

export class DistribucionMacrosDto {
  @IsNumber() @Min(0.1) @Max(0.5) proteina: number;
  @IsNumber() @Min(0.2) @Max(0.7) carbohidrato: number;
  @IsNumber() @Min(0.1) @Max(0.5) grasa: number;
}

/** Porcentaje de kcal por tiempo de comida (0–1). Un tiempo en 0 o ausente no se incluye. */
export class DistribucionTiemposDto {
  @IsOptional() @IsNumber() @Min(0) @Max(1) DESAYUNO?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) MERIENDA_AM?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) ALMUERZO?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) MERIENDA_PM?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) CENA?: number;
}

export class GenerarPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  /** true (por defecto): Bedrock propone y el backend valida. false: solo reglas. */
  @IsOptional()
  @IsBoolean()
  usarIa?: boolean;

  /** Sobrescribe las kcal calculadas con Mifflin-St Jeor. */
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(5000)
  kcalObjetivo?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DistribucionMacrosDto)
  distribucionMacros?: DistribucionMacrosDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DistribucionTiemposDto)
  distribucionTiempos?: DistribucionTiemposDto;

  /** Indicaciones extra para la IA, ej. "prefiere desayunos rápidos". */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  indicaciones?: string;
}

export class ActualizarPlanDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsNumber() @Min(1000) @Max(5000) kcalObjetivo?: number;
  @IsOptional() @IsNumber() @Min(0) proteinaG?: number;
  @IsOptional() @IsNumber() @Min(0) carbohidratoG?: number;
  @IsOptional() @IsNumber() @Min(0) grasaG?: number;
  @IsOptional() @IsString() @MaxLength(4000) justificacion?: string;
}

export class ItemPlanDto {
  @IsUUID()
  alimentoId: string;

  @IsNumber()
  @Min(0.25)
  @Max(6)
  porciones: number;
}

export class ReemplazarItemsDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ItemPlanDto)
  items: ItemPlanDto[];
}
