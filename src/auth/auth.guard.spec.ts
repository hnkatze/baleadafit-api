import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { AuthGuard } from './auth.guard.js';
import type { TokenVerificado, UsuarioActual } from './auth.types.js';
import { PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import type { FirebaseService } from './firebase.service.js';

function contexto(
  headers: Record<string, string>,
  metadatos: Record<string, unknown> = {},
) {
  const handler = () => undefined;
  for (const [k, v] of Object.entries(metadatos))
    Reflect.defineMetadata(k, v, handler);
  const req: { headers: Record<string, string>; usuario?: UsuarioActual } = {
    headers,
  };
  const ctx = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  let prisma: PrismaMock;
  let token: TokenVerificado;
  let guard: AuthGuard;

  beforeEach(() => {
    prisma = crearPrismaMock();
    token = { uid: 'uid-1', email: 'ana@correo.hn', emailVerificado: true };
    const firebase = {
      verificarToken: vi.fn(async () => token),
    } as unknown as FirebaseService;
    guard = new AuthGuard(new Reflector(), firebase, prisma);
    prisma.nutricionista.findUnique.mockResolvedValue(null);
    prisma.paciente.findUnique.mockResolvedValue(null);
    prisma.paciente.findFirst.mockResolvedValue(null);
  });

  it('deja pasar rutas públicas sin token', async () => {
    const { ctx } = contexto({}, { [PUBLIC_KEY]: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rechaza peticiones sin Bearer token', async () => {
    const { ctx } = contexto({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('resuelve a la nutricionista por uid', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({ id: 'n1' });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario).toMatchObject({
      rol: 'nutricionista',
      nutricionistaId: 'n1',
    });
  });

  it('resuelve al paciente activo por uid', async () => {
    prisma.paciente.findUnique.mockResolvedValue({
      id: 'p1',
      nutricionistaId: 'n1',
      activo: true,
    });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario).toMatchObject({
      rol: 'paciente',
      pacienteId: 'p1',
      nutricionistaId: 'n1',
    });
  });

  it('vincula al paciente por correo verificado en su primer inicio de sesión', async () => {
    prisma.paciente.findFirst.mockResolvedValue({
      id: 'p2',
      nutricionistaId: 'n1',
    });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(prisma.paciente.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { firebaseUid: 'uid-1' },
    });
    expect(req.usuario?.rol).toBe('paciente');
  });

  it('no vincula por correo si no está verificado', async () => {
    token.emailVerificado = false;
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(prisma.paciente.findFirst).not.toHaveBeenCalled();
    expect(req.usuario?.rol).toBe('sin_perfil');
  });

  it('trata como sin perfil a un paciente dado de baja', async () => {
    prisma.paciente.findUnique.mockResolvedValue({
      id: 'p1',
      nutricionistaId: 'n1',
      activo: false,
    });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario?.rol).toBe('sin_perfil');
  });

  it('aplica @Roles: 403 si el rol no coincide', async () => {
    prisma.paciente.findUnique.mockResolvedValue({
      id: 'p1',
      nutricionistaId: 'n1',
      activo: true,
    });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ROLES_KEY]: ['nutricionista'] },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aplica @Roles: permite el rol correcto', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({ id: 'n1' });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ROLES_KEY]: ['nutricionista'] },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
