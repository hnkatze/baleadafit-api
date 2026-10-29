import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CategoriaAlimento, TipoComida } from '../generated/prisma/enums.js';

export class CrearAlimentoDto {
  /** @example "Baleada sencilla" */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  /** @example "PLATO_TIPICO" */
  @IsEnum(CategoriaAlimento)
  categoria: CategoriaAlimento;

  /** @example "1 unidad" */
  @IsString()
  @MaxLength(60)
  porcionDescripcion: string;

  /** @example 120 */
  @IsNumber()
  @Min(1)
  @Max(2000)
  porcionGramos: number;

  /**
   * kcal por porción.
   * @example 330
   */
  @IsNumber()
  @Min(0)
  @Max(3000)
  kcal: number;

  /** @example 11 */
  @IsNumber()
  @Min(0)
  proteinaG: number;

  /** @example 42 */
  @IsNumber()
  @Min(0)
  carbohidratoG: number;

  /** @example 13 */
  @IsNumber()
  @Min(0)
  grasaG: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fibraG?: number;

  /**
   * Sodio en miligramos por porción. Estimado: verificar con INCAP.
   * @example 420
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  sodioMg?: number;

  /**
   * Potasio en miligramos por porción.
   * @example 610
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  potasioMg?: number;

  /**
   * Fósforo en miligramos por porción.
   * @example 180
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(800)
  fosforoMg?: number;

  /**
   * Azúcares totales en gramos por porción (incluye los naturales).
   * @example 6
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  azucaresG?: number;

  /**
   * Grasa saturada en gramos por porción.
   * @example 3.5
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  grasasSatG?: number;

  /**
   * Índice glucémico de la porción (0-110). Nulo en alimentos sin carbohidratos.
   * @example 55
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(110)
  indiceGlucemico?: number | null;

  /**
   * Tiempos de comida en los que se puede sugerir.
   * @example ["DESAYUNO", "CENA"]
   */
  @IsArray()
  @ArrayUnique()
  @IsEnum(TipoComida, { each: true })
  tiposComida: TipoComida[];

  /**
   * Etiquetas que coinciden con códigos de restricción.
   * @example ["gluten", "lactosa"]
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contiene?: string[];

  /** @example true */
  @IsOptional()
  @IsBoolean()
  esTipicoHn?: boolean;

  /** @example "Tabla de Composición de Alimentos INCAP" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fuente?: string;
}

export class ActualizarAlimentoDto extends PartialType(CrearAlimentoDto) {
  /** false lo saca del catálogo sin borrarlo. */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class BuscarAlimentosDto {
  /** @example "baleada" */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CategoriaAlimento)
  categoria?: CategoriaAlimento;

  @IsOptional()
  @IsEnum(TipoComida)
  tipoComida?: TipoComida;

  @ApiPropertyOptional({
    type: String,
    description:
      'Excluye alimentos con alguna de estas etiquetas, separadas por coma.',
    example: 'lactosa,gluten',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  excluir?: string[];

  /** Solo platos y alimentos típicos hondureños. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  soloTipicos?: boolean;
}
