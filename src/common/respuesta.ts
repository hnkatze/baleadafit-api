import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CODIGOS, type CodigoFalla, type DetalleFalla, type SobreFalla } from './codigos.js';
import { MetaPaginacionEntity } from './paginacion.js';

export * from './codigos.js';

export class DetalleFallaEntity implements DetalleFalla {
  @ApiProperty({
    enum: CODIGOS,
    enumName: 'CodigoFalla',
    example: CODIGOS.NO_ENCONTRADO,
    description: 'Código estable del fallo, para decidir sin leer el mensaje.',
  })
  codigo: CodigoFalla;

  @ApiProperty({
    example: 'Paciente no encontrado.',
    description: 'Mensaje listo para mostrar al usuario.',
  })
  mensaje: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['pesoKg must not be greater than 400'],
    description: 'Errores por campo. Sólo en fallos de validación.',
  })
  detalles?: string[];
}

export class SobreFallaEntity implements SobreFalla {
  @ApiProperty({ example: false })
  ok: false;

  @ApiProperty({ type: () => DetalleFallaEntity })
  error: DetalleFallaEntity;
}

export interface OpcionesSobreOk {
  /** El endpoint devuelve una lista. */
  esLista?: boolean;
  /** La lista viene paginada: `meta` describe la página. */
  paginada?: boolean;
  descripcion?: string;
  ejemplo?: unknown;
}

const cuerpoDeExito = (
  modelo: Type<unknown>,
  { esLista, paginada, ejemplo }: OpcionesSobreOk,
): Record<string, unknown> => {
  const data = esLista
    ? { type: 'array', items: { $ref: getSchemaPath(modelo) } }
    : { $ref: getSchemaPath(modelo) };
  const propiedades: Record<string, unknown> = {
    ok: { type: 'boolean', example: true },
    data,
  };
  if (paginada) {
    propiedades.meta = { $ref: getSchemaPath(MetaPaginacionEntity) };
  }
  return {
    type: 'object',
    required: paginada ? ['ok', 'data', 'meta'] : ['ok', 'data'],
    properties: propiedades,
    ...(ejemplo === undefined ? {} : { example: { ok: true, data: ejemplo } }),
  };
};

/** Documenta un 200 con el sobre de éxito. */
export const ApiSobreOk = (
  modelo: Type<unknown>,
  opciones: OpcionesSobreOk = {},
) =>
  applyDecorators(
    ApiExtraModels(modelo, MetaPaginacionEntity, DetalleFallaEntity),
    ApiOkResponse({
      description: opciones.descripcion,
      schema: cuerpoDeExito(modelo, opciones),
    }),
  );

/** Documenta un 201 con el sobre de éxito. */
export const ApiSobreCreado = (modelo: Type<unknown>, descripcion?: string) =>
  applyDecorators(
    ApiExtraModels(modelo),
    ApiCreatedResponse({
      description: descripcion,
      schema: cuerpoDeExito(modelo, {}),
    }),
  );

/** Documenta un fallo con el sobre de error en el status que corresponda. */
export const ApiSobreFalla = (
  status: number,
  descripcion: string,
  codigo?: CodigoFalla,
) => {
  const error: Record<string, unknown> = {
    $ref: getSchemaPath(DetalleFallaEntity),
  };
  if (codigo) {
    error.example = { codigo, mensaje: descripcion };
  }
  return applyDecorators(
    ApiExtraModels(DetalleFallaEntity),
    ApiResponse({
      status,
      description: descripcion,
      schema: {
        type: 'object',
        required: ['ok', 'error'],
        properties: {
          ok: { type: 'boolean', example: false },
          error,
        },
      },
    }),
  );
};
