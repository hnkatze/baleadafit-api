import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import type { UsuarioActual } from '../auth/auth.types.js';
import { ROLES_KEY } from '../auth/decorators.js';
import { Plataforma } from '../generated/prisma/enums.js';
import { crearPrismaMock, errorUnico } from '../testing/prisma-mock.js';
import { DispositivosController } from './dispositivos.controller.js';
import { RegistrarDispositivoDto } from './dispositivos.dto.js';
import { DispositivosService } from './dispositivos.service.js';

const PACIENTE: UsuarioActual = {
  uid: 'uid-paciente',
  emailVerificado: true,
  rol: 'paciente',
  pacienteId: 'paciente-1',
  nutricionistaId: 'nutri-1',
};

const NUTRICIONISTA: UsuarioActual = {
  uid: 'uid-nutri',
  emailVerificado: true,
  rol: 'nutricionista',
  nutricionistaId: 'nutri-1',
};

const TOKEN = 'fMEr1:APA91bH-token-de-prueba-1234567890';

const FILA = {
  id: 'd-1',
  token: TOKEN,
  plataforma: Plataforma.ANDROID,
  nutricionistaId: null,
  pacienteId: 'paciente-1',
  creadoEn: new Date('2026-11-08T04:00:00Z'),
  ultimoUso: new Date('2026-11-08T04:00:00Z'),
};

const dto = (cambios: Partial<RegistrarDispositivoDto> = {}) =>
  Object.assign(new RegistrarDispositivoDto(), {
    token: TOKEN,
    plataforma: Plataforma.ANDROID,
    ...cambios,
  });

function armar() {
  const prisma = crearPrismaMock();
  return { prisma, service: new DispositivosService(prisma) };
}

/** Valida como lo hace el `ValidationPipe` global: whitelist y propiedades desconocidas prohibidas. */
async function validar(cuerpo: Record<string, unknown>) {
  const instancia = plainToInstance(RegistrarDispositivoDto, cuerpo);
  const errores = await validate(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errores.map((e) => ({
    campo: e.property,
    reglas: Object.keys(e.constraints ?? {}),
  }));
}

describe('DispositivosService', () => {
  it('cuelga el dispositivo del paciente que lo registra', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockResolvedValue(FILA);

    const { dispositivo, creado } = await service.registrar(PACIENTE, dto());

    expect(creado).toBe(true);
    expect(prisma.dispositivo.create.mock.calls).toEqual([
      [
        {
          data: {
            token: TOKEN,
            plataforma: Plataforma.ANDROID,
            nutricionistaId: null,
            pacienteId: 'paciente-1',
          },
        },
      ],
    ]);
    expect(dispositivo.rol).toBe('paciente');
  });

  it('cuelga el dispositivo de la nutricionista cuando el rol es nutricionista', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockResolvedValue({
      ...FILA,
      pacienteId: null,
      nutricionistaId: 'nutri-1',
    });

    const { dispositivo } = await service.registrar(NUTRICIONISTA, dto());

    expect(prisma.dispositivo.create.mock.calls[0][0]).toEqual({
      data: {
        token: TOKEN,
        plataforma: Plataforma.ANDROID,
        nutricionistaId: 'nutri-1',
        pacienteId: null,
      },
    });
    expect(dispositivo.rol).toBe('nutricionista');
  });

  it('no deja registrar a un usuario sin perfil y no toca la base', async () => {
    const { prisma, service } = armar();
    const sinPerfil: UsuarioActual = {
      uid: 'uid-sin',
      emailVerificado: true,
      rol: 'sin_perfil',
    };

    await expect(service.registrar(sinPerfil, dto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.dispositivo.create.mock.calls).toEqual([]);
  });

  it('repetir el registro refresca el token y deja de crear', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(errorUnico('token'));
    prisma.dispositivo.update.mockResolvedValue(FILA);

    const { creado } = await service.registrar(
      PACIENTE,
      dto({ plataforma: Plataforma.WEB }),
    );

    expect(creado).toBe(false);
    const llamada = prisma.dispositivo.update.mock.calls[0][0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(llamada.where).toEqual({ token: TOKEN });
    expect(llamada.data).toEqual({
      plataforma: Plataforma.WEB,
      nutricionistaId: null,
      pacienteId: 'paciente-1',
      ultimoUso: expect.any(Date),
    });
  });

  it('un token que ya estaba en otra cuenta pasa al perfil que lo registra', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(errorUnico('token'));
    prisma.dispositivo.update.mockResolvedValue({
      ...FILA,
      pacienteId: null,
      nutricionistaId: 'nutri-1',
    });

    const { dispositivo } = await service.registrar(NUTRICIONISTA, dto());

    const llamada = prisma.dispositivo.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(llamada.data).toMatchObject({
      nutricionistaId: 'nutri-1',
      pacienteId: null,
    });
    expect(dispositivo.rol).toBe('nutricionista');
  });

  it('no se traga un error de base que no sea de unicidad', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(new Error('conexión perdida'));

    await expect(service.registrar(PACIENTE, dto())).rejects.toThrow(
      'conexión perdida',
    );
    expect(prisma.dispositivo.update.mock.calls).toEqual([]);
  });

  it('lista solo los dispositivos de ese perfil, el más reciente primero', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.findMany.mockResolvedValue([FILA]);

    const filas = await service.listar(PACIENTE);

    expect(prisma.dispositivo.findMany.mock.calls).toEqual([
      [
        {
          where: { nutricionistaId: null, pacienteId: 'paciente-1' },
          orderBy: [{ ultimoUso: 'desc' }, { id: 'desc' }],
        },
      ],
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].rol).toBe('paciente');
  });

  it('borra el dispositivo filtrando por token y dueño a la vez', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.eliminar(PACIENTE, TOKEN)).resolves.toEqual({
      token: TOKEN,
      eliminado: true,
    });
    expect(prisma.dispositivo.deleteMany.mock.calls).toEqual([
      [
        {
          where: {
            token: TOKEN,
            nutricionistaId: null,
            pacienteId: 'paciente-1',
          },
        },
      ],
    ]);
  });

  it('el token de otra cuenta no se borra y responde 404 sin decir si existe', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.eliminar(PACIENTE, TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.dispositivo.delete.mock.calls).toEqual([]);
  });
});

describe('registro de dispositivos: contrato de la ruta', () => {
  it('solo la pueden usar nutricionistas y pacientes', () => {
    expect(Reflect.getMetadata(ROLES_KEY, DispositivosController)).toEqual([
      'nutricionista',
      'paciente',
    ]);
  });

  it('acepta un token de FCM con una plataforma del enum', async () => {
    expect(await validar({ token: TOKEN, plataforma: 'IOS' })).toEqual([]);
  });

  it('rechaza un token demasiado corto para ser de FCM', async () => {
    expect(await validar({ token: 'corto', plataforma: 'ANDROID' })).toEqual([
      { campo: 'token', reglas: ['minLength'] },
    ]);
  });

  it('rechaza una plataforma que no está en el enum', async () => {
    expect(await validar({ token: TOKEN, plataforma: 'BLACKBERRY' })).toEqual([
      { campo: 'plataforma', reglas: ['isEnum'] },
    ]);
  });

  it('rechaza que el cliente imponga el dueño o el rol', async () => {
    const errores = await validar({
      token: TOKEN,
      plataforma: 'ANDROID',
      pacienteId: 'paciente-ajeno',
      rol: 'nutricionista',
    });
    expect(errores.map((e) => e.campo).sort()).toEqual(['pacienteId', 'rol']);
  });
});
