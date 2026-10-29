import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Rol, TokenVerificado, UsuarioActual } from './auth.types.js';
import { PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import { FirebaseService } from './firebase.service.js';

/**
 * Guard global: valida el token de Firebase, resuelve el rol del usuario
 * y aplica @Roles(). El frontend nunca toca la base de datos directamente.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, destino))
      return true;

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioActual }>();
    const [tipo, token] = req.headers.authorization?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Falta el token (Authorization: Bearer <token>).',
      );
    }

    const usuario = await this.resolverUsuario(
      await this.firebase.verificarToken(token),
    );
    req.usuario = usuario;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_KEY,
      destino,
    );
    if (roles?.length && !roles.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para este recurso.');
    }
    return true;
  }

  private async resolverUsuario(t: TokenVerificado): Promise<UsuarioActual> {
    const base = { uid: t.uid, email: t.email };

    const nutri = await this.prisma.nutricionista.findUnique({
      where: { firebaseUid: t.uid },
      select: { id: true },
    });
    if (nutri)
      return { ...base, rol: 'nutricionista', nutricionistaId: nutri.id };

    const paciente = await this.prisma.paciente.findUnique({
      where: { firebaseUid: t.uid },
      select: { id: true, nutricionistaId: true, activo: true },
    });
    if (paciente?.activo) {
      return {
        ...base,
        rol: 'paciente',
        pacienteId: paciente.id,
        nutricionistaId: paciente.nutricionistaId,
      };
    }

    // Primer inicio de sesión del paciente: se vincula por correo verificado.
    if (t.email && t.emailVerificado) {
      const porCorreo = await this.prisma.paciente.findFirst({
        where: {
          correo: { equals: t.email, mode: 'insensitive' },
          firebaseUid: null,
          activo: true,
        },
        orderBy: { creadoEn: 'desc' },
        select: { id: true, nutricionistaId: true },
      });
      if (porCorreo) {
        await this.prisma.paciente.update({
          where: { id: porCorreo.id },
          data: { firebaseUid: t.uid },
        });
        return {
          ...base,
          rol: 'paciente',
          pacienteId: porCorreo.id,
          nutricionistaId: porCorreo.nutricionistaId,
        };
      }
    }

    return { ...base, rol: 'sin_perfil' };
  }
}
