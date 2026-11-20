import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistroNutricionistaDto {
  /** @example "Lic. Sofía Herrera" */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  /**
   * Número de colegiada en el Colegio de Nutricionistas de Honduras.
   * @example "1402"
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  colegiado?: string;

  /** @example "+504 9999-0000" */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  /**
   * Formato YYYY-MM-DD. Se rechaza a quien no tenga al menos 18 años cumplidos.
   * @example "1990-03-15"
   */
  @IsDateString()
  // `@IsDateString()` acepta ISO 8601 completo ("20150601", "2015-W10", "2015-123"),
  // que `aFecha` convierte en Invalid Date y deja la edad en NaN. El formato se
  // restringe acá porque la columna es DATE y el cliente manda día, no instante.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaNacimiento debe tener el formato YYYY-MM-DD.',
  })
  fechaNacimiento: string;
}
