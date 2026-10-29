import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import type { TipoComida } from '../generated/prisma/enums.js';
import { AlimentosService } from '../alimentos/alimentos.service.js';
import {
  DISTRIBUCION_TIEMPOS_DEFAULT,
  ORDEN_TIEMPOS,
  desviacion,
  macrosDesdeKcal,
  sumarNutrientes,
  validarDistribucion,
} from '../nutricion/nutricion.util.js';
import { PacientesService } from '../pacientes/pacientes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarPlanDto,
  GenerarPlanDto,
  ReemplazarItemsDto,
} from './planes.dto.js';
import { RecomendadorService } from './recomendador.service.js';

const INCLUDE_DETALLE = {
  tiempos: {
    orderBy: { orden: 'asc' as const },
    include: { items: { include: { alimento: true } } },
  },
};

@Injectable()
export class PlanesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly pacientes: PacientesService,
    private readonly alimentos: AlimentosService,
    private readonly recomendador: RecomendadorService,
  ) {}

  async listar(pacienteId: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    return this.prisma.planAlimenticio.findMany({
      where: { pacienteId },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async detalle(planId: string, nutricionistaId: string) {
    await this.acceso.planDeNutricionista(planId, nutricionistaId);
    return this.detalleConTotales(planId);
  }

  /** Plan con totales por tiempo y del día, y desviación contra la meta. */
  async detalleConTotales(planId: string) {
    const plan = await this.prisma.planAlimenticio.findUnique({
      where: { id: planId },
      include: INCLUDE_DETALLE,
    });
    if (!plan) throw new NotFoundException('Plan no encontrado.');

    const tiempos = plan.tiempos.map((t) => {
      const totales = sumarNutrientes(t.items);
      const kcalMeta = Math.round(plan.kcalObjetivo * t.pctKcal);
      return {
        ...t,
        kcalMeta,
        totales,
        desviacion: desviacion(totales.kcal, kcalMeta),
      };
    });
    const totales = sumarNutrientes(plan.tiempos.flatMap((t) => t.items));
    return {
      ...plan,
      tiempos,
      totales,
      desviacion: desviacion(totales.kcal, plan.kcalObjetivo),
    };
  }

  /** Genera un plan en BORRADOR con el recomendador híbrido (Bedrock + reglas). */
  async generar(
    pacienteId: string,
    nutricionistaId: string,
    dto: GenerarPlanDto,
  ) {
    const req = await this.pacientes.requerimiento(pacienteId, nutricionistaId);
    const paciente = await this.acceso.pacienteDeNutricionista(
      pacienteId,
      nutricionistaId,
    );

    const distribucion = dto.distribucionTiempos
      ? { ...dto.distribucionTiempos }
      : DISTRIBUCION_TIEMPOS_DEFAULT;
    try {
      validarDistribucion(distribucion, 'tiempos de comida');
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const kcalObjetivo = dto.kcalObjetivo ?? req.kcalObjetivo;
    const macros = dto.distribucionMacros
      ? macrosDesdeKcal(kcalObjetivo, dto.distribucionMacros)
      : dto.kcalObjetivo
        ? macrosDesdeKcal(kcalObjetivo, req.distribucionMacros)
        : {
            proteinaG: req.proteinaG,
            carbohidratoG: req.carbohidratoG,
            grasaG: req.grasaG,
          };

    const { alimentos, restricciones } =
      await this.alimentos.catalogoParaPaciente(pacienteId);
    if (alimentos.length < 5) {
      throw new BadRequestException(
        'El catálogo apto para este paciente tiene muy pocos alimentos.',
      );
    }

    const resultado = await this.recomendador.generar({
      catalogo: alimentos,
      perfilClinico: await this.pacientes.contextoClinico(
        pacienteId,
        nutricionistaId,
      ),
      kcalObjetivo,
      ...macros,
      distribucion,
      restricciones,
      meta: paciente.meta,
      usarIa: dto.usarIa ?? true,
      indicaciones: dto.indicaciones,
      semilla: Date.now() % 1000,
    });

    const plan = await this.prisma.planAlimenticio.create({
      data: {
        pacienteId,
        nutricionistaId,
        nombre: dto.nombre ?? `Plan ${new Date().toISOString().slice(0, 10)}`,
        kcalObjetivo,
        ...macros,
        estado: 'BORRADOR',
        origen: resultado.origen,
        justificacion: resultado.justificacion,
        tiempos: {
          create: resultado.tiempos.map((t) => ({
            tipo: t.tipo,
            pctKcal: t.pctKcal,
            orden: ORDEN_TIEMPOS.indexOf(t.tipo),
            items: { create: t.items },
          })),
        },
      },
    });
    return this.detalleConTotales(plan.id);
  }

  async actualizar(
    planId: string,
    nutricionistaId: string,
    dto: ActualizarPlanDto,
  ) {
    const plan = await this.acceso.planDeNutricionista(planId, nutricionistaId);
    this.asegurarEditable(plan.estado);
    await this.prisma.planAlimenticio.update({
      where: { id: planId },
      data: dto,
    });
    return this.detalleConTotales(planId);
  }

  /** Edición manual de un tiempo de comida: reemplaza sus alimentos. */
  async reemplazarItems(
    planId: string,
    tipo: TipoComida,
    nutricionistaId: string,
    dto: ReemplazarItemsDto,
  ) {
    const plan = await this.acceso.planDeNutricionista(planId, nutricionistaId);
    this.asegurarEditable(plan.estado);
    const tiempo = await this.prisma.tiempoComida.findUnique({
      where: { planId_tipo: { planId, tipo } },
    });
    if (!tiempo) throw new NotFoundException(`El plan no tiene ${tipo}.`);

    const ids = [...new Set(dto.items.map((i) => i.alimentoId))];
    const existentes = await this.prisma.alimento.count({
      where: { id: { in: ids }, activo: true },
    });
    if (existentes !== ids.length)
      throw new BadRequestException(
        'Hay alimentos que no existen o están inactivos.',
      );

    await this.prisma.$transaction([
      this.prisma.planItem.deleteMany({ where: { tiempoComidaId: tiempo.id } }),
      this.prisma.planItem.createMany({
        data: dto.items.map((i) => ({ ...i, tiempoComidaId: tiempo.id })),
      }),
    ]);
    return this.detalleConTotales(planId);
  }

  /** Aprueba el plan: queda ACTIVO y el anterior activo pasa a ARCHIVADO. */
  async activar(planId: string, nutricionistaId: string) {
    const plan = await this.acceso.planDeNutricionista(planId, nutricionistaId);
    if (plan.estado === 'ARCHIVADO')
      throw new BadRequestException('No se puede activar un plan archivado.');
    await this.prisma.$transaction([
      this.prisma.planAlimenticio.updateMany({
        where: {
          pacienteId: plan.pacienteId,
          estado: 'ACTIVO',
          NOT: { id: planId },
        },
        data: { estado: 'ARCHIVADO' },
      }),
      this.prisma.planAlimenticio.update({
        where: { id: planId },
        data: { estado: 'ACTIVO', aprobadoEn: new Date() },
      }),
    ]);
    return this.detalleConTotales(planId);
  }

  async eliminar(planId: string, nutricionistaId: string) {
    const plan = await this.acceso.planDeNutricionista(planId, nutricionistaId);
    if (plan.estado !== 'BORRADOR')
      throw new BadRequestException('Solo se pueden eliminar borradores.');
    await this.prisma.planAlimenticio.delete({ where: { id: planId } });
  }

  private asegurarEditable(estado: string) {
    if (estado === 'ARCHIVADO')
      throw new BadRequestException('El plan está archivado.');
  }
}
