import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
