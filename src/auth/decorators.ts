import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol, UsuarioActual } from './auth.types.js';

export const PUBLIC_KEY = 'esPublico';
export const ROLES_KEY = 'roles';

/** Ruta accesible sin token. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Restringe la ruta a uno o más roles. Sin este decorador basta con estar autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export const UsuarioAct = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest<{ usuario: UsuarioActual }>().usuario,
);
