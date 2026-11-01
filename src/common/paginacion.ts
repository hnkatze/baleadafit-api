import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { CODIGOS } from './codigos.js';
import { LIMITE_POR_DEFECTO } from './paginacion.dto.js';
import type { PaginacionDto } from './paginacion.dto.js';

// `PaginacionDto` vive en `paginacion.dto.ts` para que el plugin de Swagger
// (dtoFileNameSuffix) le agregue los query params al documento OpenAPI. Se
// re-exporta acá para que los consumidores sigan importando desde este módulo.
export {
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
  PaginacionDto,
} from './paginacion.dto.js';

/** Lo que viaja en `meta` cuando la lista está paginada. */
export interface MetaPaginacion {
  /** Filas pedidas en esta página. */
  limit: number;
  /** Sólo en modo offset: desde qué fila arranca esta página. */
  offset?: number;
  /** Sólo en modo offset: filas totales que cumplen el filtro. */
  total?: number;
  /** Sólo en modo cursor: cursor de la página siguiente, `null` en la última. */
  nextCursor?: string | null;
  /** Si queda al menos una fila después de esta página. */
  hasMore: boolean;
}

export class MetaPaginacionEntity implements MetaPaginacion {
  @ApiProperty({ example: 20, description: 'Filas pedidas en esta página.' })
  limit: number;

  @ApiProperty({
    required: false,
    example: 0,
    description: 'Modo offset: desde qué fila arranca esta página.',
  })
  offset?: number;

  @ApiProperty({
    required: false,
    example: 137,
    description: 'Modo offset: filas totales que cumplen el filtro.',
  })
  total?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    example: 'ZjQ3ZmYxYzIt',
    description:
      'Modo cursor: cursor de la página siguiente, `null` en la última.',
  })
  nextCursor?: string | null;

  @ApiProperty({
    example: true,
    description: 'Si queda al menos una fila después de esta página.',
  })
  hasMore: boolean;
}

/** Una página de resultados: las filas y cómo pedir la siguiente. */
export class Pagina<T> {
  constructor(
    readonly items: T[],
    readonly meta: MetaPaginacion,
  ) {}
}

export const esPagina = (valor: unknown): valor is Pagina<unknown> =>
  valor instanceof Pagina;

/** Lo que el helper necesita de cada servicio: su consulta, su total y su id. */
export interface ConsultaPagina<T> {
  /** Filas de la página, con el `orderBy` y el `where` del recurso ya fijos. */
  filas: (args: {
    take: number;
    skip?: number;
    cursor?: { id: string };
  }) => Promise<T[]>;
  /** Filas totales del filtro. Sólo se llama en modo offset. */
  total: () => Promise<number>;
  /** Identidad de la fila: el cursor es un id de este recurso. */
  id: (fila: T) => string;
}

const codificar = (id: string): string =>
  Buffer.from(id, 'utf8').toString('base64url');

const cursorInvalido = (): BadRequestException =>
  new BadRequestException({
    codigo: CODIGOS.CURSOR_INVALIDO,
    mensaje:
      'El cursor no es válido o no corresponde a una fila de esta lista. Pedí la primera página sin `cursor`.',
  });

/** El cursor es opaco para el cliente, pero por dentro es el id de la fila. */
const decodificar = (cursor: string): string => {
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!isUUID(id)) throw cursorInvalido();
  return id;
};

/** Prisma responde P2025 cuando el cursor apunta a una fila que no existe. */
const esFilaAusente = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'P2025';

/**
 * Arma la página según el modo que eligió el cliente.
 *
 * En modo cursor pide `limit + 1` filas para saber si hay siguiente sin contar;
 * en modo offset pide `limit` y cuenta el total en paralelo.
 *
 * @throws BadRequestException `VALIDACION` si vienen `cursor` y `offset` juntos.
 * @throws BadRequestException `CURSOR_INVALIDO` si el cursor no es de este recurso.
 */
export async function paginar<T>(
  pedido: PaginacionDto,
  consulta: ConsultaPagina<T>,
): Promise<Pagina<T>> {
  const limit = pedido.limit ?? LIMITE_POR_DEFECTO;

  if (pedido.cursor !== undefined && pedido.offset !== undefined) {
    throw new BadRequestException({
      codigo: CODIGOS.VALIDACION,
      mensaje: 'Usá `cursor` o `offset`, no los dos en la misma petición.',
    });
  }

  if (pedido.cursor !== undefined) {
    const cursor = { id: decodificar(pedido.cursor) };
    let filas: T[];
    try {
      filas = await consulta.filas({ take: limit + 1, skip: 1, cursor });
    } catch (error) {
      if (esFilaAusente(error)) throw cursorInvalido();
      throw error;
    }
    const hasMore = filas.length > limit;
    const items = hasMore ? filas.slice(0, limit) : filas;
    const ultima = items.at(-1);
    return new Pagina(items, {
      limit,
      nextCursor: hasMore && ultima ? codificar(consulta.id(ultima)) : null,
      hasMore,
    });
  }

  const offset = pedido.offset ?? 0;
  const [filas, total] = await Promise.all([
    consulta.filas({ take: limit, skip: offset }),
    consulta.total(),
  ]);
  const ultima = filas.at(-1);
  const hasMore = offset + filas.length < total;
  return new Pagina(filas, {
    limit,
    offset,
    total,
    // `nextCursor` viaja también en modo offset a propósito: es lo único que le
    // permite a la app arrancar el scroll infinito. Sin esto la primera página
    // llega sin cursor y el cliente tendría que codificar un id a mano, que es
    // justo lo que el cursor opaco evita.
    nextCursor: hasMore && ultima ? codificar(consulta.id(ultima)) : null,
    hasMore,
  });
}
