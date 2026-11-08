import { Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioActual } from '../auth/auth.types.js';
import type { Dispositivo } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrarDispositivoDto } from './dispositivos.dto.js';

/**
 * Registro de tokens de push. No envía nada: el envío por FCM es el corte
 * siguiente. Guardar el token desde acá es lo que le permite al API saber a
 * quién notificar cuando eso exista.
 */
@Injectable()
export class DispositivosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o refresca el dispositivo del usuario autenticado.
   *
   * La clave es el `token`, no el usuario: un mismo celular cambia de dueño al
   * re-loguear y el token no puede duplicarse. Devuelve `creado` para que el
   * controlador responda 201 la primera vez y 200 cuando solo refrescó. El
   * `uid` y el `rol` salen del token de Firebase, nunca del body.
   */
  async registrar(
    u: UsuarioActual,
    dto: RegistrarDispositivoDto,
  ): Promise<{ dispositivo: Dispositivo; creado: boolean }> {
    try {
      const dispositivo = await this.prisma.dispositivo.create({
        data: {
          token: dto.token,
          plataforma: dto.plataforma,
          uid: u.uid,
          rol: u.rol,
        },
      });
      return { dispositivo, creado: true };
    } catch (e) {
      // El índice único de `token` decide quién gana si dos llamadas coinciden.
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const dispositivo = await this.prisma.dispositivo.update({
        where: { token: dto.token },
        data: {
          plataforma: dto.plataforma,
          uid: u.uid,
          rol: u.rol,
          ultimoUso: new Date(),
        },
      });
      return { dispositivo, creado: false };
    }
  }

  /** Dispositivos del usuario autenticado, el que se usó más recientemente primero. */
  listar(uid: string) {
    return this.prisma.dispositivo.findMany({
      where: { uid },
      orderBy: [{ ultimoUso: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Dar de baja un dispositivo (cerrar sesión, desinstalar).
   *
   * Filtra por `token` y `uid` en la misma consulta: así el token de otra
   * cuenta no se borra y la respuesta 404 no revela si el token existe.
   */
  async eliminar(uid: string, token: string) {
    const { count } = await this.prisma.dispositivo.deleteMany({
      where: { token, uid },
    });
    if (!count)
      throw new NotFoundException(
        'Ese dispositivo no está registrado en tu cuenta.',
      );
    return { token, eliminado: true };
  }
}
