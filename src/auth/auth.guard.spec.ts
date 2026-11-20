import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { AuthGuard } from './auth.guard.js';
import type { TokenVerificado, UsuarioActual } from './auth.types.js';
import { ADMIN_KEY, PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import type { FirebaseService } from './firebase.service.js';
import { EstadoNutricionista } from '../generated/prisma/enums.js';

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
  let adminCorreos: string | undefined;

  beforeEach(() => {
    prisma = crearPrismaMock();
    token = { uid: 'uid-1', email: 'ana@correo.hn', emailVerificado: true };
    adminCorreos = undefined;
    const firebase = {
      verificarToken: vi.fn(async () => token),
    } as unknown as FirebaseService;
    const config = {
      get: (clave: string) =>
        clave === 'ADMIN_CORREOS' ? adminCorreos : undefined,
    } as unknown as ConfigService;
    guard = new AuthGuard(new Reflector(), firebase, prisma, config);
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
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.APROBADO,
    });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario).toMatchObject({
      rol: 'nutricionista',
      nutricionistaId: 'n1',
      estado: EstadoNutricionista.APROBADO,
    });
  });

  it('deja a la nutricionista sin aprobar en rol nutricionista_pendiente', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.PENDIENTE,
    });
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario).toMatchObject({
      rol: 'nutricionista_pendiente',
      nutricionistaId: 'n1',
      estado: EstadoNutricionista.PENDIENTE,
    });
  });

  it('aplica @Roles de nutricionista: 403 a la nutricionista pendiente', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.PENDIENTE,
    });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ROLES_KEY]: ['nutricionista'] },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deja a la nutricionista rechazada sin acceso, igual que la pendiente', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.RECHAZADO,
    });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ROLES_KEY]: ['nutricionista'] },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('marca esAdmin cuando el correo está en ADMIN_CORREOS', async () => {
    adminCorreos = ' Otra@Correo.hn , ana@correo.hn ';
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario?.esAdmin).toBe(true);
  });

  it('no da admin a un correo sin verificar, aunque esté en ADMIN_CORREOS', async () => {
    adminCorreos = 'ana@correo.hn';
    token.emailVerificado = false;
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario?.esAdmin).toBe(false);
  });

  it('aplica @SoloAdmin: 403 a un admin con el correo sin verificar', async () => {
    adminCorreos = 'ana@correo.hn';
    token.emailVerificado = false;
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ADMIN_KEY]: true },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('no marca esAdmin a quien no está en la lista', async () => {
    adminCorreos = 'jefa@correo.hn';
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario?.esAdmin).toBe(false);
  });

  it('aplica @SoloAdmin: 403 a quien no está en ADMIN_CORREOS', async () => {
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ADMIN_KEY]: true },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aplica @SoloAdmin: deja pasar a un admin con perfil de nutricionista aprobada', async () => {
    adminCorreos = 'ana@correo.hn';
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.APROBADO,
    });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ADMIN_KEY]: true },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
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

  it('expone en el usuario si el correo del token está verificado', async () => {
    token.emailVerificado = false;
    const { ctx, req } = contexto({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(req.usuario).toMatchObject({
      rol: 'sin_perfil',
      emailVerificado: false,
    });
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
    prisma.nutricionista.findUnique.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.APROBADO,
    });
    const { ctx } = contexto(
      { authorization: 'Bearer t' },
      { [ROLES_KEY]: ['nutricionista'] },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
