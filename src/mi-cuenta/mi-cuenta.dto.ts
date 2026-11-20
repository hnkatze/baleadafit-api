import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
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

const recortarTexto = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Edición del perfil propio de la nutricionista.
 *
 * `telefono` y `colegiado` aceptan `null` para limpiar el campo, igual que `dosis`
 * y `frecuencia` en la medicación del expediente: omitirlos conserva el valor
 * guardado y el texto vacío se rechaza para no guardar `""` en lugar de `null`.
 *
 * `nombre` no se puede limpiar: `null` o el texto vacío responden 400.
 *
 * `correo`, `estado` y `firebaseUid` no se declaran a propósito: el pipe global
 * con `forbidNonWhitelisted` los rechaza, porque la cuenta y su aprobación no se
 * editan desde el perfil.
 */
export class ActualizarPerfilDto {
  /** @example "Lic. Sofía Herrera" */
  @ValidateIf((_, valor: unknown) => valor !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;

  /**
   * `null` limpia el campo.
   * @example "+504 9999-0000"
   */
  @IsOptional()
  @Transform(recortarTexto)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  telefono?: string | null;

  /**
   * `null` limpia el campo.
   * @example "1402"
   */
  @IsOptional()
  @Transform(recortarTexto)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  colegiado?: string | null;
}
