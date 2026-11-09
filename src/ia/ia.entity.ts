/* Modelo de respuesta para la documentación de Swagger (no se instancia). */
import { ApiProperty } from '@nestjs/swagger';

/** Última llamada real a Bedrock. */
export class LlamadaIaEntity {
  /** @example true */
  ok: boolean;

  /** @example "The security token included in the request is invalid." */
  error?: string;

  /** @example "2026-02-11T15:04:05.000Z" */
  en: string;

  /**
   * Tokens de entrada que consumió la llamada (el catálogo filtrado del paciente).
   * @example 6100
   */
  entradaTokens?: number;

  /**
   * Tokens de salida, que son los que dominan la latencia: ~43 tokens/s medidos
   * con Sonnet 4.6.
   * @example 2702
   */
  salidaTokens?: number;

  /**
   * Duración total de la llamada en milisegundos.
   * @example 63000
   */
  ms?: number;

  /**
   * Milisegundos hasta el primer token. Es lo que percibe quien espera.
   * @example 2400
   */
  ttftMs?: number;

  /**
   * `stream` si la respuesta se leyó por `ConverseStream` (el socket no queda
   * inactivo, así que el `requestTimeout` no es el techo) y `json` si se esperó
   * la respuesta entera.
   * @example "stream"
   */
  transporte?: string;
}

export class EstadoIaEntity {
  /** @example true */
  habilitado: boolean;

  /**
   * Modelo configurado en `BEDROCK_MODEL_ID`.
   * @example "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
   */
  modelo?: string;

  /**
   * Región configurada en `AWS_REGION`.
   * @example "us-east-1"
   */
  region: string;

  @ApiProperty({
    type: LlamadaIaEntity,
    nullable: true,
    description: '`null` mientras no se haya llamado a Bedrock.',
  })
  ultimaLlamada: LlamadaIaEntity | null;
}

export class PruebaIaEntity {
  /** @example true */
  ok: boolean;

  /** @example "IA deshabilitada o BEDROCK_MODEL_ID sin configurar." */
  error?: string;
}
