import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { aFecha, hoyIso } from '../common/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cambianValores, datosVersion } from './alimento-version.js';
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
      return await this.prisma.$transaction(async (tx) => {
        const alimento = await tx.alimento.create({ data: dto });
        await tx.alimentoVersion.create({
          data: {
            alimentoId: alimento.id,
            ...datosVersion(alimento, 1, aFecha(hoyIso())),
          },
        });
        return alimento;
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('Ya existe un alimento con ese nombre.');
      throw e;
    }
  }

  /**
   * Editar los valores nutricionales abre una versión nueva y cierra la
   * anterior: los planes ya armados siguen apuntando a la versión que usaron.
   * Editar solo la identidad (nombre, categoría, etiquetas) no versiona.
   */
  async actualizar(id: string, dto: ActualizarAlimentoDto) {
    const actual = await this.detalle(id);
    if (!cambianValores(actual, dto))
      return this.prisma.alimento.update({ where: { id }, data: dto });

    const hoy = aFecha(hoyIso());
    return this.prisma.$transaction(async (tx) => {
      const ultima = await tx.alimentoVersion.findFirst({
        where: { alimentoId: id },
        orderBy: { version: 'desc' },
      });
      if (ultima) {
        await tx.alimentoVersion.update({
          where: { id: ultima.id },
          data: { vigenteHasta: hoy },
        });
      }
      const alimento = await tx.alimento.update({ where: { id }, data: dto });
      await tx.alimentoVersion.create({
        data: {
          alimentoId: id,
          ...datosVersion(alimento, (ultima?.version ?? 0) + 1, hoy),
        },
      });
      return alimento;
    });
  }

  /** Historial de valores del alimento: de la versión más nueva a la más vieja. */
  async versiones(alimentoId: string) {
    const alimento = await this.prisma.alimento.findUnique({
      where: { id: alimentoId },
      select: { id: true },
    });
    if (!alimento) throw new NotFoundException('Alimento no encontrado.');
    return this.prisma.alimentoVersion.findMany({
      where: { alimentoId },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        tabla: true,
        fuente: true,
        vigenteDesde: true,
        vigenteHasta: true,
        porcionDescripcion: true,
        porcionGramos: true,
        kcal: true,
        proteinaG: true,
        carbohidratoG: true,
        grasaG: true,
        fibraG: true,
        sodioMg: true,
        potasioMg: true,
        fosforoMg: true,
        azucaresG: true,
        grasasSatG: true,
        indiceGlucemico: true,
      },
    });
  }

  restricciones() {
    return this.prisma.restriccion.findMany({ orderBy: { nombre: 'asc' } });
  }

  condiciones() {
    return this.prisma.condicion.findMany({ orderBy: { nombre: 'asc' } });
  }
}
