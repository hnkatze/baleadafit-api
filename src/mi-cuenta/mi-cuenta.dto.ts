import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RegistrarComidaDto {
  /** ID del tiempo de comida del plan (viene en `GET /me/hoy`). */
  @IsUUID()
  tiempoComidaId: string;

  /**
   * YYYY-MM-DD. Por defecto, hoy.
   * @example "2026-10-28"
   */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  /** @example true */
  @IsBoolean()
  cumplido: boolean;

  /** @example "Cambié el plátano por yuca" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
