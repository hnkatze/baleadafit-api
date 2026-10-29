import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { calcularRequerimiento, imc } from '../nutricion/nutricion.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarPacienteDto,
  BuscarPacientesDto,
  CrearMedicionDto,
  CrearPacienteDto,
} from './pacientes.dto.js';

@Injectable()
export class PacientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  async listar(nutricionistaId: string, f: BuscarPacientesDto) {
    const where: Prisma.PacienteWhereInput = { nutricionistaId };
    if (!f.incluirInactivos) where.activo = true;
    if (f.q?.trim()) {
      const q = f.q.trim();
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellido: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
      ];
    }
    const pacientes = await this.prisma.paciente.findMany({
      where,
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: {
        mediciones: { orderBy: { fecha: 'desc' }, take: 1 },
        planes: {
          where: { estado: 'ACTIVO' },
          select: { id: true, nombre: true },
          take: 1,
        },
      },
    });
    return pacientes.map(({ mediciones, planes, ...p }) => ({
      ...p,
      ultimaMedicion: mediciones[0] ?? null,
      planActivo: planes[0] ?? null,
    }));
  }

  async detalle(id: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    return this.prisma.paciente.findUnique({
      where: { id },
      include: {
        restricciones: { include: { restriccion: true } },
        mediciones: { orderBy: { fecha: 'desc' }, take: 10 },
        citas: {
          where: { fechaHora: { gte: new Date() } },
          orderBy: { fechaHora: 'asc' },
          take: 3,
        },
        planes: {
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            nombre: true,
            estado: true,
            origen: true,
            kcalObjetivo: true,
            creadoEn: true,
          },
        },
      },
    });
  }

  async crear(nutricionistaId: string, dto: CrearPacienteDto) {
    const { restricciones, fechaNacimiento, ...datos } = dto;
    const restriccionIds = await this.idsRestricciones(restricciones);
    try {
      return await this.prisma.paciente.create({
        data: {
          ...datos,
          fechaNacimiento: aFecha(fechaNacimiento),
          nutricionistaId,
          restricciones: {
            create: restriccionIds.map((restriccionId) => ({ restriccionId })),
          },
        },
        include: { restricciones: { include: { restriccion: true } } },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Ya tienes un paciente con ese correo.');
      }
      throw e;
    }
  }

  async actualizar(
    id: string,
    nutricionistaId: string,
    dto: ActualizarPacienteDto,
  ) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    const { restricciones, fechaNacimiento, ...datos } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (restricciones) {
        const ids = await this.idsRestricciones(restricciones);
        await tx.pacienteRestriccion.deleteMany({ where: { pacienteId: id } });
        await tx.pacienteRestriccion.createMany({
          data: ids.map((restriccionId) => ({ pacienteId: id, restriccionId })),
        });
      }
      return tx.paciente.update({
        where: { id },
        data: {
          ...datos,
          ...(fechaNacimiento
            ? { fechaNacimiento: aFecha(fechaNacimiento) }
            : {}),
        },
        include: { restricciones: { include: { restriccion: true } } },
      });
    });
  }

  /** Baja lógica: se conserva el historial clínico. */
  async desactivar(id: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    return this.prisma.paciente.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ─── Mediciones ──────────────────────────────────────────────────────────

  async mediciones(pacienteId: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    return this.listarMediciones(pacienteId);
  }

  async listarMediciones(pacienteId: string) {
    const lista = await this.prisma.medicion.findMany({
      where: { pacienteId },
      orderBy: { fecha: 'asc' },
    });
    return lista.map((m) => ({ ...m, imc: imc(m.pesoKg, m.tallaCm) }));
  }

  async agregarMedicion(
    pacienteId: string,
    nutricionistaId: string,
    dto: CrearMedicionDto,
  ) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    const { fecha, ...datos } = dto;
    return this.prisma.medicion.create({
      data: { ...datos, pacienteId, fecha: aFecha(fecha ?? hoyIso()) },
    });
  }

  async eliminarMedicion(medicionId: string, nutricionistaId: string) {
    const m = await this.prisma.medicion.findFirst({
      where: { id: medicionId, paciente: { nutricionistaId } },
    });
    if (!m) throw new NotFoundException('Medición no encontrada.');
    await this.prisma.medicion.delete({ where: { id: medicionId } });
  }

  /** Requerimiento calórico con la medición más reciente (Mifflin-St Jeor). */
  async requerimiento(pacienteId: string, nutricionistaId: string) {
    const paciente = await this.acceso.pacienteDeNutricionista(
      pacienteId,
      nutricionistaId,
    );
    const medicion = await this.prisma.medicion.findFirst({
      where: { pacienteId },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });
    if (!medicion) {
      throw new BadRequestException(
        'El paciente necesita al menos una medición (peso y talla).',
      );
    }
    return {
      medicion,
      ...calcularRequerimiento({
        pesoKg: medicion.pesoKg,
        tallaCm: medicion.tallaCm,
        fechaNacimiento: paciente.fechaNacimiento,
        sexo: paciente.sexo,
        nivelActividad: paciente.nivelActividad,
        meta: paciente.meta,
      }),
    };
  }

  // ─── Diario del paciente (vista de la nutricionista) ────────────────────

  async adherencia(
    pacienteId: string,
    nutricionistaId: string,
    desde?: string,
    hasta?: string,
  ) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    const fin = hasta ? aFecha(hasta) : aFecha(hoyIso());
    const inicio = desde ? aFecha(desde) : sumarDias(fin, -13);
    const registros = await this.prisma.registroComida.findMany({
      where: { pacienteId, fecha: { gte: inicio, lte: fin } },
      orderBy: [{ fecha: 'desc' }],
      include: { tiempoComida: { select: { tipo: true } } },
    });
    const cumplidos = registros.filter((r) => r.cumplido).length;
    return {
      desde: inicio,
      hasta: fin,
      totalRegistros: registros.length,
      cumplidos,
      adherencia: registros.length
        ? Math.round((cumplidos / registros.length) * 100) / 100
        : null,
      registros,
    };
  }

  private async idsRestricciones(codigos?: string[]): Promise<string[]> {
    if (!codigos?.length) return [];
    const encontradas = await this.prisma.restriccion.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true, codigo: true },
    });
    const faltantes = codigos.filter(
      (c) => !encontradas.some((r) => r.codigo === c),
    );
    if (faltantes.length) {
      throw new BadRequestException(
        `Restricciones desconocidas: ${faltantes.join(', ')}`,
      );
    }
    return encontradas.map((r) => r.id);
  }
}
