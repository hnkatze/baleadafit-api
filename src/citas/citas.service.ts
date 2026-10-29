import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { aFecha } from '../common/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarCitaDto,
  BuscarCitasDto,
  CrearCitaDto,
} from './citas.dto.js';

const INCLUDE_PACIENTE = {
  paciente: {
    select: { id: true, nombre: true, apellido: true, telefono: true },
  },
};

@Injectable()
export class CitasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  listar(nutricionistaId: string, f: BuscarCitasDto) {
    const where: Prisma.CitaWhereInput = { nutricionistaId };
    if (f.pacienteId) where.pacienteId = f.pacienteId;
    if (f.estado) where.estado = f.estado;
    if (f.desde || f.hasta) {
      where.fechaHora = {
        ...(f.desde ? { gte: new Date(f.desde) } : {}),
        ...(f.hasta ? { lte: new Date(f.hasta) } : {}),
      };
    }
    return this.prisma.cita.findMany({
      where,
      orderBy: { fechaHora: 'asc' },
      include: INCLUDE_PACIENTE,
    });
  }

  async crear(nutricionistaId: string, dto: CrearCitaDto) {
    await this.acceso.pacienteDeNutricionista(dto.pacienteId, nutricionistaId);
    const fechaHora = new Date(dto.fechaHora);
    const duracionMin = dto.duracionMin ?? 45;
    await this.verificarChoque(nutricionistaId, fechaHora, duracionMin);
    return this.prisma.cita.create({
      data: { ...dto, fechaHora, duracionMin, nutricionistaId },
      include: INCLUDE_PACIENTE,
    });
  }

  async actualizar(
    id: string,
    nutricionistaId: string,
    dto: ActualizarCitaDto,
  ) {
    const cita = await this.prisma.cita.findFirst({
      where: { id, nutricionistaId },
    });
    if (!cita) throw new NotFoundException('Cita no encontrada.');
    if (dto.pacienteId)
      await this.acceso.pacienteDeNutricionista(
        dto.pacienteId,
        nutricionistaId,
      );

    const fechaHora = dto.fechaHora ? new Date(dto.fechaHora) : cita.fechaHora;
    const duracionMin = dto.duracionMin ?? cita.duracionMin;
    const estado = dto.estado ?? cita.estado;
    // La columna es de solo fecha: `aFecha` se queda con la fecha local del ISO,
    // así un "2026-12-01T20:00:00-06:00" no se corre al 2 de diciembre. Un `null`
    // explícito borra la fecha.
    const proximaCitaSugerida =
      dto.proximaCitaSugerida === undefined
        ? undefined
        : dto.proximaCitaSugerida
          ? aFecha(dto.proximaCitaSugerida)
          : null;
    if (estado === 'PROGRAMADA' && (dto.fechaHora || dto.duracionMin)) {
      await this.verificarChoque(nutricionistaId, fechaHora, duracionMin, id);
    }
    return this.prisma.cita.update({
      where: { id },
      data: { ...dto, fechaHora, duracionMin, proximaCitaSugerida },
      include: INCLUDE_PACIENTE,
    });
  }

  /** Evita dos citas programadas que se traslapen en la agenda de la nutricionista. */
  private async verificarChoque(
    nutricionistaId: string,
    inicio: Date,
    duracionMin: number,
    excluirId?: string,
  ) {
    const fin = new Date(inicio.getTime() + duracionMin * 60_000);
    const cercanas = await this.prisma.cita.findMany({
      where: {
        nutricionistaId,
        estado: 'PROGRAMADA',
        id: excluirId ? { not: excluirId } : undefined,
        fechaHora: {
          lt: fin,
          gte: new Date(inicio.getTime() - 4 * 60 * 60_000),
        },
      },
    });
    const choque = cercanas.find(
      (c) => c.fechaHora.getTime() + c.duracionMin * 60_000 > inicio.getTime(),
    );
    if (choque)
      throw new ConflictException('Ya hay una cita programada en ese horario.');
  }
}
