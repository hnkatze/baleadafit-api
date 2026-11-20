import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { EstadoNutricionista } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Rol, TokenVerificado, UsuarioActual } from './auth.types.js';
import { ADMIN_KEY, PUBLIC_KEY, ROLES_KEY } from './decorators.js';
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
    private readonly config: ConfigService,
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

    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, destino) &&
      !usuario.esAdmin
    ) {
      throw new ForbiddenException('No tienes permiso para este recurso.');
    }
    return true;
  }

  /**
   * Lista de correos con permiso de administración, separada por comas. Vive en
   * configuración, no en la base: un admin no es un perfil del dominio.
   */
  private esAdmin(email?: string): boolean {
    if (!email) return false;
    const lista = (this.config.get<string>('ADMIN_CORREOS') ?? '')
      .split(',')
      .map((correo) => correo.trim().toLowerCase())
      .filter(Boolean);
    return lista.includes(email.toLowerCase());
  }

  private async resolverUsuario(t: TokenVerificado): Promise<UsuarioActual> {
    const base = {
      uid: t.uid,
      email: t.email,
      emailVerificado: t.emailVerificado,
      // El correo verificado es parte del permiso: sin él, cualquiera que cree
      // una cuenta con el correo del admin reclama la lista y se aprueba solo.
      esAdmin: t.emailVerificado === true && this.esAdmin(t.email),
    };

    const nutri = await this.prisma.nutricionista.findUnique({
      where: { firebaseUid: t.uid },
      select: { id: true, estado: true },
    });
    if (nutri)
      return {
        ...base,
        // Solo un perfil aprobado entra como `nutricionista`. El resto queda en un
        // rol que los `@Roles('nutricionista')` rechazan sin tocar un controller.
        rol:
          nutri.estado === EstadoNutricionista.APROBADO
            ? 'nutricionista'
            : 'nutricionista_pendiente',
        nutricionistaId: nutri.id,
        estado: nutri.estado,
      };

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
