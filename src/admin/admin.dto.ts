import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoNutricionista } from '../generated/prisma/enums.js';

export class ListarNutricionistasQueryDto {
  /**
   * Estado de aprobación a listar. Por defecto `PENDIENTE`: son los perfiles
   * que llevan más tiempo esperando revisión.
   * @example "PENDIENTE"
   */
  @IsOptional()
  @IsEnum(EstadoNutricionista)
  estado?: EstadoNutricionista;
}

export class CambiarEstadoNutricionistaDto {
  /**
   * Estado nuevo del perfil.
   * @example "RECHAZADO"
   */
  @IsEnum(EstadoNutricionista)
  estado: EstadoNutricionista;

  /**
   * Obligatorio con `RECHAZADO`: la nutricionista necesita saber qué corregir.
   * Con `APROBADO` se ignora y el motivo guardado se limpia.
   * @example "El número de colegiatura no coincide con el del Colegio."
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
