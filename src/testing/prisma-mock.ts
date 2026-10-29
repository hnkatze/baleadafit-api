import { vi, type Mock } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';

type ModeloMock = Record<string, Mock>;

export type PrismaMock = Record<string, ModeloMock> & {
  $transaction: Mock;
};

/**
 * PrismaService falso para pruebas unitarias: cualquier `prisma.<modelo>.<método>`
 * es un `vi.fn()` (memoizado), y `$transaction` acepta un arreglo de promesas o un callback.
 */
export function crearPrismaMock(): PrismaMock & PrismaService {
  const modelos = new Map<string, ModeloMock>();
  const modelo = (nombre: string): ModeloMock => {
    if (!modelos.has(nombre)) {
      const metodos = new Map<string, Mock>();
      modelos.set(
        nombre,
        new Proxy({} as ModeloMock, {
          get: (_, metodo: string) => {
            if (!metodos.has(metodo)) metodos.set(metodo, vi.fn());
            return metodos.get(metodo);
          },
        }),
      );
    }
    return modelos.get(nombre)!;
  };

  const mock: Record<string, unknown> = {};
  const proxy = new Proxy(mock, {
    get: (_, prop: string) => {
      if (prop === 'then') return undefined;
      if (prop === '$transaction') {
        mock.$transaction ??= vi.fn((arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(proxy)
            : Promise.all(arg as Promise<unknown>[]),
        );
        return mock.$transaction;
      }
      return modelo(prop);
    },
  });
  return proxy as unknown as PrismaMock & PrismaService;
}

/** Error con el código de Prisma para restricciones únicas. */
export const errorUnico = () =>
  Object.assign(new Error('Unique constraint'), { code: 'P2002' });
