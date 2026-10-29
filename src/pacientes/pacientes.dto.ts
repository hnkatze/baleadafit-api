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
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Meta, NivelActividad, Sexo } from '../generated/prisma/enums.js';

export class CrearPacienteDto {
  /** @example "Ana" */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  /** @example "López" */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellido: string;

  /**
   * Con este correo el paciente se vincula al iniciar sesión en la app.
   * @example "ana@correo.hn"
   */
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  correo?: string;

  /** @example "+504 9999-0000" */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  /** @example "F" */
  @IsEnum(Sexo)
  sexo: Sexo;

  /**
   * Formato YYYY-MM-DD.
   * @example "1995-04-10"
   */
  @IsDateString()
  fechaNacimiento: string;

  /**
   * Factor: sedentario 1.2, ligero 1.375, moderado 1.55, intenso 1.725, muy intenso 1.9.
   * @example "LIGERO"
   */
  @IsOptional()
  @IsEnum(NivelActividad)
  nivelActividad?: NivelActividad;

  /**
   * Ajuste calórico: bajar −500, mantener 0, subir +300.
   * @example "BAJAR"
   */
  @IsOptional()
  @IsEnum(Meta)
  meta?: Meta;

  /** @example "Prefiere cenas ligeras. Trabaja por turnos." */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  /**
   * Códigos de `GET /restricciones`.
   * @example ["lactosa"]
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  restricciones?: string[];
}

export class ActualizarPacienteDto extends PartialType(CrearPacienteDto) {}

export class BuscarPacientesDto {
  /**
   * Busca en nombre, apellido o correo.
   * @example "López"
   */
  @IsOptional()
  @IsString()
  q?: string;

  /** Incluir pacientes dados de baja. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluirInactivos?: boolean;
}

export class CrearMedicionDto {
  /**
   * Formato YYYY-MM-DD. Por defecto, hoy.
   * @example "2026-10-28"
   */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  /** @example 72.5 */
  @IsNumber()
  @Min(20)
  @Max(400)
  pesoKg: number;

  /** @example 160 */
  @IsNumber()
  @Min(80)
  @Max(250)
  tallaCm: number;

  /**
   * Porcentaje de grasa corporal.
   * @example 34
   */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(70)
  pctGrasa?: number;

  /** @example 88 */
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
