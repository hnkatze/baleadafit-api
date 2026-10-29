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
