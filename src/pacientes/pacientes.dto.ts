import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Meta, NivelActividad, Sexo } from '../generated/prisma/enums.js';

export class CrearPacienteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellido: string;

  /** Con este correo el paciente se vincula al iniciar sesión en la app. */
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsEnum(Sexo)
  sexo: Sexo;

  /** Formato YYYY-MM-DD */
  @IsDateString()
  fechaNacimiento: string;

  @IsOptional()
  @IsEnum(NivelActividad)
  nivelActividad?: NivelActividad;

  @IsOptional()
  @IsEnum(Meta)
  meta?: Meta;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  /** Códigos de restricción (ej. ["lactosa", "cerdo"]) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  restricciones?: string[];
}

export class ActualizarPacienteDto extends PartialType(CrearPacienteDto) {}

export class BuscarPacientesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluirInactivos?: boolean;
}

export class CrearMedicionDto {
  /** Formato YYYY-MM-DD. Por defecto, hoy. */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsNumber()
  @Min(20)
  @Max(400)
  pesoKg: number;

  @IsNumber()
  @Min(80)
  @Max(250)
  tallaCm: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(70)
  pctGrasa?: number;

  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(250)
  cinturaCm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}

export class UuidParam {
  @IsUUID()
  id: string;
}
