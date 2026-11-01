import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { paginar, type ConsultaPagina } from './paginacion.js';
import { PaginacionDto } from './paginacion.dto.js';

const FILA = { id: '3f1c1a7e-0000-4000-8000-000000000001' };
const OTRA = { id: '3f1c1a7e-0000-4000-8000-000000000002' };
const TERCERA = { id: '3f1c1a7e-0000-4000-8000-000000000003' };

const pedido = (d: Partial<PaginacionDto> = {}): PaginacionDto =>
  Object.assign(new PaginacionDto(), d);

const codificar = (id: string): string =>
  Buffer.from(id, 'utf8').toString('base64url');

const consulta = (
  filas: unknown[],
  total: number | Error = 0,
): ConsultaPagina<{ id: string }> & { filas: Mock; total: Mock } => ({
  filas: vi.fn().mockResolvedValue(filas),
  total:
    total instanceof Error
      ? vi.fn().mockRejectedValue(total)
      : vi.fn().mockResolvedValue(total),
  id: (f) => f.id,
});

describe('paginar', () => {
  describe('modo offset (web)', () => {
    it('pide limit y skip, y devuelve el total de la consulta', async () => {
      const c = consulta([FILA, OTRA], 5);

      const pagina = await paginar(pedido({ limit: 2, offset: 2 }), c);

      expect(c.filas).toHaveBeenCalledWith({ take: 2, skip: 2 });
      expect(c.total).toHaveBeenCalledTimes(1);
      expect(pagina.items).toEqual([FILA, OTRA]);
      expect(pagina.meta).toEqual({
        limit: 2,
        offset: 2,
        total: 5,
        hasMore: true,
      });
    });

    it('marca hasMore en falso en la última página', async () => {
      const c = consulta([TERCERA], 3);

      const pagina = await paginar(pedido({ limit: 2, offset: 2 }), c);

      expect(pagina.meta).toMatchObject({ total: 3, hasMore: false });
    });

    it('arranca en offset 0 y con 20 filas si el cliente no pide nada', async () => {
      const c = consulta([], 0);

      const pagina = await paginar(pedido(), c);

      expect(c.filas).toHaveBeenCalledWith({ take: 20, skip: 0 });
      expect(pagina.meta).toMatchObject({ limit: 20, offset: 0, hasMore: false });
    });

    it('no calcula nextCursor: en modo offset la página se pide con offset', async () => {
      const c = consulta([FILA], 9);

      const pagina = await paginar(pedido({ limit: 1 }), c);

      expect(pagina.meta).not.toHaveProperty('nextCursor');
    });
  });

  describe('modo cursor (mobile)', () => {
    it('sigue desde la fila del cursor y no cuenta el total', async () => {
      // El helper pide una fila de más: 3 para un limit de 2 significa "hay siguiente".
      const c = consulta([OTRA, TERCERA, FILA]);

      const pagina = await paginar(
        pedido({ limit: 2, cursor: codificar(FILA.id) }),
        c,
      );

      // Pide una fila de más para saber si hay siguiente sin un COUNT.
      expect(c.filas).toHaveBeenCalledWith({
        take: 3,
        skip: 1,
        cursor: { id: FILA.id },
      });
      expect(c.total).not.toHaveBeenCalled();
      expect(pagina.items).toEqual([OTRA, TERCERA]);
      expect(pagina.meta).toEqual({
        limit: 2,
        nextCursor: codificar(TERCERA.id),
        hasMore: true,
      });
    });

    it('cierra la lista con nextCursor null cuando no hay más filas', async () => {
      const c = consulta([OTRA]);

      const pagina = await paginar(
        pedido({ limit: 2, cursor: codificar(FILA.id) }),
        c,
      );

      expect(pagina.items).toEqual([OTRA]);
      expect(pagina.meta).toEqual({
        limit: 2,
        nextCursor: null,
        hasMore: false,
      });
    });

    it('rechaza un cursor que no es un id de esta API', async () => {
      const c = consulta([]);

      await expect(
        paginar(pedido({ cursor: 'no-es-un-id' }), c),
      ).rejects.toMatchObject({
        response: { codigo: 'CURSOR_INVALIDO' },
      });
      expect(c.filas).not.toHaveBeenCalled();
    });

    it('rechaza un cursor de otro recurso cuando la fila no existe', async () => {
      const c = consulta([]);
      c.filas.mockRejectedValue(Object.assign(new Error('no existe'), { code: 'P2025' }));

      await expect(
        paginar(pedido({ cursor: codificar(FILA.id) }), c),
      ).rejects.toMatchObject({
        response: { codigo: 'CURSOR_INVALIDO' },
      });
    });

    it('no traga otros errores de la consulta', async () => {
      const c = consulta([]);
      c.filas.mockRejectedValue(Object.assign(new Error('boom'), { code: 'P1001' }));

      await expect(
        paginar(pedido({ cursor: codificar(FILA.id) }), c),
      ).rejects.toThrow('boom');
    });
  });

  it('rechaza cursor y offset juntos', async () => {
    const c = consulta([]);

    const error = paginar(
      pedido({ cursor: codificar(FILA.id), offset: 10 }),
      c,
    );

    await expect(error).rejects.toBeInstanceOf(BadRequestException);
    await expect(error).rejects.toMatchObject({
      response: { codigo: 'VALIDACION' },
    });
  });
});
