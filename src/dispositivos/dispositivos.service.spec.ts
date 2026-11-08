import { NotFoundException } from '@nestjs/common';
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
};

const TOKEN = 'fMEr1:APA91bH-token-de-prueba-1234567890';

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
  it('registra el token con el dueño y el rol que salen del token de Firebase', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockResolvedValue({ id: 'd-1', token: TOKEN });

    const { dispositivo, creado } = await service.registrar(PACIENTE, dto());

    expect(creado).toBe(true);
    expect(dispositivo).toEqual({ id: 'd-1', token: TOKEN });
    expect(prisma.dispositivo.create).toHaveBeenCalledWith({
      data: {
        token: TOKEN,
        plataforma: Plataforma.ANDROID,
        uid: 'uid-paciente',
        rol: 'paciente',
      },
    });
  });

  it('repetir el registro refresca el mismo token en vez de crear otra fila', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(errorUnico('token'));
    prisma.dispositivo.update.mockResolvedValue({ id: 'd-1' });

    const { creado } = await service.registrar(
      PACIENTE,
      dto({ plataforma: Plataforma.WEB }),
    );

    expect(creado).toBe(false);
    expect(prisma.dispositivo.update).toHaveBeenCalledWith({
      where: { token: TOKEN },
      data: {
        plataforma: Plataforma.WEB,
        uid: 'uid-paciente',
        rol: 'paciente',
        ultimoUso: expect.any(Date),
      },
    });
  });

  it('un token que ya estaba en otra cuenta pasa al usuario que lo registra', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(errorUnico('token'));
    prisma.dispositivo.update.mockResolvedValue({ id: 'd-1' });

    await service.registrar(
      { ...PACIENTE, uid: 'uid-otro', rol: 'nutricionista' },
      dto(),
    );

    const llamada = prisma.dispositivo.update.mock.calls[0][0] as {
      where: unknown;
      data: { uid: string; rol: string };
    };
    expect(llamada.where).toEqual({ token: TOKEN });
    expect(llamada.data.uid).toBe('uid-otro');
    expect(llamada.data.rol).toBe('nutricionista');
  });

  it('no se traga un error de base que no sea de unicidad', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.create.mockRejectedValue(new Error('conexión perdida'));

    await expect(service.registrar(PACIENTE, dto())).rejects.toThrow(
      'conexión perdida',
    );
    expect(prisma.dispositivo.update).not.toHaveBeenCalled();
  });

  it('lista solo los dispositivos del usuario, el más reciente primero', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.findMany.mockResolvedValue([]);

    await service.listar('uid-paciente');

    expect(prisma.dispositivo.findMany).toHaveBeenCalledWith({
      where: { uid: 'uid-paciente' },
      orderBy: [{ ultimoUso: 'desc' }, { id: 'desc' }],
    });
  });

  it('borra el dispositivo filtrando por token y dueño a la vez', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.eliminar('uid-paciente', TOKEN)).resolves.toEqual({
      token: TOKEN,
      eliminado: true,
    });
    expect(prisma.dispositivo.deleteMany.mock.calls).toEqual([
      [{ where: { token: TOKEN, uid: 'uid-paciente' } }],
    ]);
  });

  it('el token de otra cuenta no se borra y responde 404 sin decir si existe', async () => {
    const { prisma, service } = armar();
    prisma.dispositivo.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.eliminar('uid-paciente', TOKEN)).rejects.toBeInstanceOf(
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
      uid: 'uid-ajeno',
      rol: 'nutricionista',
    });
    expect(errores.map((e) => e.campo).sort()).toEqual(['rol', 'uid']);
  });
});
