import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarAlimentoDto,
  BuscarAlimentosDto,
  CrearAlimentoDto,
} from './alimentos.dto.js';

@Injectable()
export class AlimentosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(f: BuscarAlimentosDto) {
    const where: Prisma.AlimentoWhereInput = { activo: true };
    if (f.q?.trim())
      where.nombre = { contains: f.q.trim(), mode: 'insensitive' };
    if (f.categoria) where.categoria = f.categoria;
    if (f.tipoComida) where.tiposComida = { has: f.tipoComida };
    if (f.soloTipicos) where.esTipicoHn = true;
    if (f.excluir?.length) where.NOT = { contiene: { hasSome: f.excluir } };
    return this.prisma.alimento.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  }

  /** Catálogo apto para un paciente: excluye lo que choca con sus restricciones. */
  async catalogoParaPaciente(pacienteId: string) {
    const restricciones = await this.prisma.pacienteRestriccion.findMany({
      where: { pacienteId },
      include: { restriccion: { select: { codigo: true } } },
    });
    const codigos = restricciones.map((r) => r.restriccion.codigo);
    return {
      restricciones: codigos,
      alimentos: await this.listar({ excluir: codigos }),
    };
  }

  async detalle(id: string) {
    const a = await this.prisma.alimento.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Alimento no encontrado.');
    return a;
  }

  async crear(dto: CrearAlimentoDto) {
    try {
      return await this.prisma.alimento.create({ data: dto });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('Ya existe un alimento con ese nombre.');
      throw e;
    }
  }

  async actualizar(id: string, dto: ActualizarAlimentoDto) {
    await this.detalle(id);
    return this.prisma.alimento.update({ where: { id }, data: dto });
  }

  restricciones() {
    return this.prisma.restriccion.findMany({ orderBy: { nombre: 'asc' } });
  }

  condiciones() {
    return this.prisma.condicion.findMany({ orderBy: { nombre: 'asc' } });
  }
}
