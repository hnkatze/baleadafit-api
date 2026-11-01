import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { aFalla } from './excepciones.filter.js';
import { SobreInterceptor } from './respuesta.interceptor.js';
import { Pagina } from './paginacion.js';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

const envolver = async (valor: unknown): Promise<unknown> => {
  const interceptor = new SobreInterceptor();
  const siguiente: CallHandler = { handle: () => of(valor) };
  return firstValueFrom(
    interceptor.intercept({} as ExecutionContext, siguiente),
  );
};

describe('SobreInterceptor', () => {
  it('envuelve un objeto en data', async () => {
    await expect(envolver({ id: 'p1' })).resolves.toEqual({
      ok: true,
      data: { id: 'p1' },
    });
  });

  it('respeta el null de un endpoint sin datos', async () => {
    await expect(envolver(null)).resolves.toEqual({ ok: true, data: null });
  });

  it('pone las filas en data y la paginación en meta', async () => {
    const pagina = new Pagina([{ id: 'a1' }], {
      limit: 1,
      offset: 0,
      total: 1,
      hasMore: false,
    });

    await expect(envolver(pagina)).resolves.toEqual({
      ok: true,
      data: [{ id: 'a1' }],
      meta: { limit: 1, offset: 0, total: 1, hasMore: false },
    });
  });

  it('no envuelve dos veces ni toca una respuesta sin cuerpo', async () => {
    const yaEnvuelto = { ok: true, data: 1 };
    await expect(envolver(yaEnvuelto)).resolves.toBe(yaEnvuelto);
    await expect(envolver(undefined)).resolves.toBeUndefined();
  });
});

describe('aFalla', () => {
  it('conserva el status y el mensaje de un 404', () => {
    expect(aFalla(new NotFoundException('Paciente no encontrado.'))).toEqual({
      status: 404,
      cuerpo: {
        ok: false,
        error: { codigo: 'NO_ENCONTRADO', mensaje: 'Paciente no encontrado.' },
      },
    });
  });

  it('conserva el 403 del correo sin verificar', () => {
    expect(
      aFalla(
        new ForbiddenException('Verifica tu correo antes de registrar el perfil.'),
      ),
    ).toMatchObject({
      status: 403,
      cuerpo: {
        error: {
          codigo: 'SIN_PERMISO',
          mensaje: 'Verifica tu correo antes de registrar el perfil.',
        },
      },
    });
  });

  it('pone los errores por campo en detalles', () => {
    const falla = aFalla(
      new BadRequestException(['pesoKg too big', 'tallaCm too small']),
    );

    expect(falla.status).toBe(400);
    expect(falla.cuerpo.error.codigo).toBe('VALIDACION');
    expect(falla.cuerpo.error.mensaje).toBe('pesoKg too big');
    expect(falla.cuerpo.error.detalles).toEqual([
      'pesoKg too big',
      'tallaCm too small',
    ]);
  });

  it('respeta un código explícito de la excepción', () => {
    const falla = aFalla(
      new BadRequestException({
        codigo: 'CURSOR_INVALIDO',
        mensaje: 'El cursor no corresponde a esta lista.',
      }),
    );

    expect(falla.cuerpo.error).toEqual({
      codigo: 'CURSOR_INVALIDO',
      mensaje: 'El cursor no corresponde a esta lista.',
    });
  });

  it('no filtra detalles internos de un error inesperado', () => {
    const falla = aFalla(new Error('arn:aws:iam::123:user/sofia sin permisos'));

    expect(falla).toEqual({
      status: 500,
      cuerpo: {
        ok: false,
        error: {
          codigo: 'ERROR_INTERNO',
          mensaje: 'Error interno del servidor.',
        },
      },
    });
  });
});
