import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Rol, UsuarioActual } from '../auth/auth.types.js';
import type { Dispositivo } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrarDispositivoDto } from './dispositivos.dto.js';

/**
 * Dueño del dispositivo: exactamente uno de los dos perfiles. La migración
 * tiene un CHECK que rechaza la fila si vienen los dos o ninguno, así que acá
 * se arma siempre completo, con el otro lado en `null` explícito.
 */
interface Dueno {
  nutricionistaId: string | null;
  pacienteId: string | null;
}

/** El `rol` no se guarda: sale de cuál de las dos columnas tiene valor. */
const conRol = (d: Dispositivo): Dispositivo & { rol: Rol } => ({
  ...d,
  rol: d.pacienteId ? 'paciente' : 'nutricionista',
});

/**
 * Registro de tokens de push. No envía nada: el envío por FCM es el corte
 * siguiente. Guardar el token es lo que le permite al API saber a quién
 * notificar cuando eso exista.
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
   * dueño sale del perfil que resolvió el guard, nunca del body.
   */
  async registrar(
    u: UsuarioActual,
    dto: RegistrarDispositivoDto,
  ): Promise<{ dispositivo: Dispositivo & { rol: Rol }; creado: boolean }> {
    const dueno = this.dueno(u);
    try {
      const dispositivo = await this.prisma.dispositivo.create({
        data: { token: dto.token, plataforma: dto.plataforma, ...dueno },
      });
      return { dispositivo: conRol(dispositivo), creado: true };
    } catch (e) {
      // El índice único de `token` decide quién gana si dos llamadas coinciden.
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const dispositivo = await this.prisma.dispositivo.update({
        where: { token: dto.token },
        data: {
          plataforma: dto.plataforma,
          ...dueno,
          ultimoUso: new Date(),
        },
      });
      return { dispositivo: conRol(dispositivo), creado: false };
    }
  }

  /** Dispositivos del usuario autenticado, el que se usó más recientemente primero. */
  async listar(u: UsuarioActual) {
    const filas = await this.prisma.dispositivo.findMany({
      where: this.dueno(u),
      orderBy: [{ ultimoUso: 'desc' }, { id: 'desc' }],
    });
    return filas.map(conRol);
  }

  /**
   * Dar de baja un dispositivo (cerrar sesión, desinstalar).
   *
   * Filtra por `token` y dueño en la misma consulta: así el token de otra
   * cuenta no se borra y la respuesta 404 no revela si el token existe.
   */
  async eliminar(u: UsuarioActual, token: string) {
    const { count } = await this.prisma.dispositivo.deleteMany({
      where: { token, ...this.dueno(u) },
    });
    if (!count)
      throw new NotFoundException(
        'Ese dispositivo no está registrado en tu cuenta.',
      );
    return { token, eliminado: true };
  }

  /**
   * Perfil dueño según el usuario autenticado. El guard ya deja pasar solo a
   * nutricionista y paciente; este chequeo hace que el servicio sea seguro por
   * sí mismo si mañana se lo llama desde otro lado.
   */
  private dueno(u: UsuarioActual): Dueno {
    if (u.rol === 'nutricionista' && u.nutricionistaId)
      return { nutricionistaId: u.nutricionistaId, pacienteId: null };
    if (u.rol === 'paciente' && u.pacienteId)
      return { nutricionistaId: null, pacienteId: u.pacienteId };
    throw new ForbiddenException(
      'Solo una nutricionista o un paciente pueden registrar dispositivos.',
    );
  }
}
