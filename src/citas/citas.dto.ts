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
  @IsUUID()
  pacienteId: string;

  /** ISO 8601 con zona, ej. 2026-11-03T15:00:00-06:00 */
  @IsDateString()
  fechaHora: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  duracionMin?: number;

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
  @IsOptional()
  @IsEnum(EstadoCita)
  estado?: EstadoCita;
}

export class BuscarCitasDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

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
