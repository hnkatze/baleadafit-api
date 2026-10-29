import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoCita } from '../generated/prisma/enums.js';

export class CrearCitaDto {
  /** ID del paciente. */
  @IsUUID()
  pacienteId: string;

  /**
   * ISO 8601 con zona horaria.
   * @example "2026-11-03T15:00:00-06:00"
   */
  @IsDateString()
  fechaHora: string;

  /**
   * Por defecto 45.
   * @example 45
   */
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  duracionMin?: number;

  /** @example "Control mensual" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}

export class ActualizarCitaDto extends PartialType(CrearCitaDto) {
  /** @example "COMPLETADA" */
  @IsOptional()
  @IsEnum(EstadoCita)
  estado?: EstadoCita;
}

export class BuscarCitasDto {
  /** @example "2026-11-01T00:00:00-06:00" */
  @IsOptional()
  @IsDateString()
  desde?: string;

  /** @example "2026-11-30T23:59:59-06:00" */
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsEnum(EstadoCita)
  estado?: EstadoCita;
}
