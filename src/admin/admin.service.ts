import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoNutricionista } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CambiarEstadoNutricionistaDto,
  ListarNutricionistasQueryDto,
} from './admin.dto.js';

/**
 * Campos del perfil que ve el admin. Ni `firebaseUid` ni `motivoRechazo`: el
 * board decide con el estado y el motivo se conoce al momento de rechazar.
 */
export const PERFIL_ADMIN_SELECT = {
  id: true,
  nombre: true,
  correo: true,
  colegiado: true,
  telefono: true,
  estado: true,
  // Sin el motivo, un perfil RECHAZADO no dice qué corregir al reabrirlo.
  motivoRechazo: true,
  fechaNacimiento: true,
  creadoEn: true,
} as const;

/** Aprobación de perfiles de nutricionista. Solo lo usa un admin. */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Perfiles de un estado, del más viejo al más nuevo: primero los que más esperaron. */
  listarNutricionistas(
    { estado = EstadoNutricionista.PENDIENTE }: ListarNutricionistasQueryDto = {},
  ) {
    return this.prisma.nutricionista.findMany({
      where: { estado },
      orderBy: { creadoEn: 'asc' },
      select: PERFIL_ADMIN_SELECT,
    });
  }

  /**
   * Aprueba o rechaza un perfil. Con `RECHAZADO` el motivo es obligatorio y se
   * guarda; con `APROBADO` se limpia, para que un motivo viejo no contradiga un
   * estado nuevo.
   */
  async cambiarEstado(
    id: string,
    { estado, motivo }: CambiarEstadoNutricionistaDto,
  ) {
    const limpio = motivo?.trim();
    if (estado === EstadoNutricionista.RECHAZADO && !limpio)
      throw new BadRequestException(
        'El motivo es obligatorio cuando el estado es RECHAZADO.',
      );

    const perfil = await this.prisma.nutricionista.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!perfil) throw new NotFoundException('Nutricionista no encontrada.');

    return this.prisma.nutricionista.update({
      where: { id },
      data: {
        estado,
        motivoRechazo:
          estado === EstadoNutricionista.RECHAZADO ? limpio! : null,
      },
      select: PERFIL_ADMIN_SELECT,
    });
  }
}
