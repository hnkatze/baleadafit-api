import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
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
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @IsEnum(CategoriaAlimento)
  categoria: CategoriaAlimento;

  @IsString()
  @MaxLength(60)
  porcionDescripcion: string;

  @IsNumber()
  @Min(1)
  @Max(2000)
  porcionGramos: number;

  @IsNumber()
  @Min(0)
  @Max(3000)
  kcal: number;

  @IsNumber()
  @Min(0)
  proteinaG: number;

  @IsNumber()
  @Min(0)
  carbohidratoG: number;

  @IsNumber()
  @Min(0)
  grasaG: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fibraG?: number;

  @IsArray()
  @ArrayUnique()
  @IsEnum(TipoComida, { each: true })
  tiposComida: TipoComida[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contiene?: string[];

  @IsOptional()
  @IsBoolean()
  esTipicoHn?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fuente?: string;
}

export class ActualizarAlimentoDto extends PartialType(CrearAlimentoDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class BuscarAlimentosDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CategoriaAlimento)
  categoria?: CategoriaAlimento;

  @IsOptional()
  @IsEnum(TipoComida)
  tipoComida?: TipoComida;

  /** Excluye alimentos que contengan alguna de estas etiquetas (separadas por coma). */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  excluir?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  soloTipicos?: boolean;
}
