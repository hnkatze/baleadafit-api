import { Injectable, NotFoundException } from '@nestjs/common';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import { PlanesService } from '../planes/planes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegistrarComidaDto } from './mi-cuenta.dto.js';

/** Lo que ve y registra el paciente en la app. Siempre limitado a sus propios datos. */
@Injectable()
export class MiCuentaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planes: PlanesService,
  ) {}

  async planActivo(pacienteId: string) {
    const plan = await this.prisma.planAlimenticio.findFirst({
      where: { pacienteId, estado: 'ACTIVO' },
      select: { id: true },
    });
    return plan ? this.planes.detalleConTotales(plan.id) : null;
  }

  /** Pantalla "Hoy": comidas del plan activo, si ya las registró y la próxima cita. */
  async hoy(pacienteId: string, fecha = hoyIso()) {
    const dia = aFecha(fecha);
    const [plan, registros, proximaCita] = await Promise.all([
      this.planActivo(pacienteId),
      this.prisma.registroComida.findMany({
        where: { pacienteId, fecha: dia },
      }),
      this.prisma.cita.findFirst({
        where: {
          pacienteId,
          estado: 'PROGRAMADA',
          fechaHora: { gte: new Date() },
        },
        orderBy: { fechaHora: 'asc' },
      }),
    ]);
    const tiempos = (plan?.tiempos ?? []).map((t) => ({
      ...t,
      registro: registros.find((r) => r.tiempoComidaId === t.id) ?? null,
    }));
    return {
      fecha,
      plan: plan && {
        id: plan.id,
        nombre: plan.nombre,
        kcalObjetivo: plan.kcalObjetivo,
        totales: plan.totales,
      },
      tiempos,
      cumplidos: tiempos.filter((t) => t.registro?.cumplido).length,
      proximaCita,
    };
  }

  citas(pacienteId: string) {
    return this.prisma.cita.findMany({
      where: { pacienteId },
      orderBy: { fechaHora: 'desc' },
      include: { nutricionista: { select: { nombre: true } } },
    });
  }

  async registrar(pacienteId: string, dto: RegistrarComidaDto) {
    const tiempo = await this.prisma.tiempoComida.findFirst({
      where: { id: dto.tiempoComidaId, plan: { pacienteId } },
    });
    if (!tiempo)
      throw new NotFoundException(
        'Tiempo de comida no encontrado en tus planes.',
      );
    const fecha = aFecha(dto.fecha ?? hoyIso());
    return this.prisma.registroComida.upsert({
      where: {
        pacienteId_tiempoComidaId_fecha: {
          pacienteId,
          tiempoComidaId: tiempo.id,
          fecha,
        },
      },
      create: {
        pacienteId,
        tiempoComidaId: tiempo.id,
        fecha,
        cumplido: dto.cumplido,
        comentario: dto.comentario,
      },
      update: { cumplido: dto.cumplido, comentario: dto.comentario },
    });
  }

  registros(pacienteId: string, desde?: string, hasta?: string) {
    const fin = aFecha(hasta ?? hoyIso());
    const inicio = desde ? aFecha(desde) : sumarDias(fin, -6);
    return this.prisma.registroComida.findMany({
      where: { pacienteId, fecha: { gte: inicio, lte: fin } },
      orderBy: { fecha: 'desc' },
      include: { tiempoComida: { select: { tipo: true } } },
    });
  }
}
