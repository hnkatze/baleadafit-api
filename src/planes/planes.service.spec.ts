import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AlimentosService } from '../alimentos/alimentos.service.js';
import { AccesoService } from '../common/acceso.service.js';
import type { PacientesService } from '../pacientes/pacientes.service.js';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { PlanesService } from './planes.service.js';
import type { RecomendadorService } from './recomendador.service.js';

const alimento = (kcal: number) => ({
  kcal,
  proteinaG: 10,
  carbohidratoG: 20,
  grasaG: 5,
});

const planGuardado = {
  id: 'plan1',
  kcalObjetivo: 2000,
  tiempos: [
    {
      id: 't1',
      tipo: 'DESAYUNO',
      pctKcal: 0.5,
      orden: 0,
      items: [{ porciones: 2, alimento: alimento(500) }],
    },
    {
      id: 't2',
      tipo: 'CENA',
      pctKcal: 0.5,
      orden: 4,
      items: [{ porciones: 1, alimento: alimento(800) }],
    },
  ],
};

describe('PlanesService', () => {
  let prisma: PrismaMock;
  let pacientes: { requerimiento: ReturnType<typeof vi.fn> };
  let alimentos: { catalogoParaPaciente: ReturnType<typeof vi.fn> };
  let recomendador: { generar: ReturnType<typeof vi.fn> };
  let svc: PlanesService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    pacientes = {
      requerimiento: vi.fn().mockResolvedValue({
        kcalObjetivo: 1800,
        proteinaG: 112.5,
        carbohidratoG: 225,
        grasaG: 50,
        distribucionMacros: { proteina: 0.25, carbohidrato: 0.5, grasa: 0.25 },
      }),
    };
    alimentos = {
      catalogoParaPaciente: vi.fn().mockResolvedValue({
        restricciones: ['lactosa'],
        alimentos: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}` })),
      }),
    };
    recomendador = {
      generar: vi.fn().mockResolvedValue({
        origen: 'IA',
        justificacion: 'ok',
        tiempos: [
          {
            tipo: 'ALMUERZO',
            pctKcal: 0.6,
            items: [{ alimentoId: 'a1', porciones: 1 }],
          },
          {
            tipo: 'DESAYUNO',
            pctKcal: 0.4,
            items: [{ alimentoId: 'a2', porciones: 2 }],
          },
        ],
      }),
    };
    svc = new PlanesService(
      prisma,
      new AccesoService(prisma),
      pacientes as unknown as PacientesService,
      alimentos as unknown as AlimentosService,
      recomendador as unknown as RecomendadorService,
    );
    prisma.paciente.findFirst.mockResolvedValue({ id: 'p1', meta: 'BAJAR' });
    prisma.planAlimenticio.findUnique.mockResolvedValue(planGuardado);
    prisma.planAlimenticio.create.mockResolvedValue({ id: 'plan1' });
  });

  it('calcula totales por tiempo y del día con su desviación', async () => {
    const plan = await svc.detalleConTotales('plan1');
    expect(plan.tiempos[0]).toMatchObject({ kcalMeta: 1000, desviacion: 0 });
    expect(plan.tiempos[0].totales.kcal).toBe(1000);
    expect(plan.tiempos[1].desviacion).toBe(-0.2);
    expect(plan.totales.kcal).toBe(1800);
    expect(plan.desviacion).toBe(-0.1);
  });

  it('responde 404 si el plan no existe', async () => {
    prisma.planAlimenticio.findUnique.mockResolvedValue(null);
    await expect(svc.detalleConTotales('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('generar', () => {
    it('crea un borrador con el resultado del recomendador', async () => {
      await svc.generar('p1', 'n1', { nombre: 'Plan A' });
      const entrada = recomendador.generar.mock.calls[0][0];
      expect(entrada).toMatchObject({
        kcalObjetivo: 1800,
        restricciones: ['lactosa'],
        meta: 'BAJAR',
        usarIa: true,
      });
      const { data } = prisma.planAlimenticio.create.mock.calls[0][0];
      expect(data).toMatchObject({
        nombre: 'Plan A',
        estado: 'BORRADOR',
        origen: 'IA',
        kcalObjetivo: 1800,
      });
      expect(
        data.tiempos.create.map((t: { tipo: string; orden: number }) => [
          t.tipo,
          t.orden,
        ]),
      ).toEqual([
        ['ALMUERZO', 2],
        ['DESAYUNO', 0],
      ]);
    });

    it('recalcula macros si se sobrescriben las kcal', async () => {
      await svc.generar('p1', 'n1', { kcalObjetivo: 2000, usarIa: false });
      const entrada = recomendador.generar.mock.calls[0][0];
      expect(entrada).toMatchObject({
        kcalObjetivo: 2000,
        proteinaG: 125,
        carbohidratoG: 250,
        usarIa: false,
      });
    });

    it('rechaza distribuciones de tiempos que no suman 100 %', async () => {
      await expect(
        svc.generar('p1', 'n1', {
          distribucionTiempos: { DESAYUNO: 0.5, CENA: 0.2 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(recomendador.generar).not.toHaveBeenCalled();
    });

    it('rechaza si el catálogo apto es muy pequeño', async () => {
      alimentos.catalogoParaPaciente.mockResolvedValue({
        restricciones: [],
        alimentos: [{ id: 'a1' }],
      });
      await expect(svc.generar('p1', 'n1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('editar', () => {
    beforeEach(() => {
      prisma.planAlimenticio.findFirst.mockResolvedValue({
        id: 'plan1',
        pacienteId: 'p1',
        estado: 'BORRADOR',
        origen: 'IA',
      });
    });

    it('no edita planes archivados', async () => {
      prisma.planAlimenticio.findFirst.mockResolvedValue({
        id: 'plan1',
        estado: 'ARCHIVADO',
      });
      await expect(
        svc.actualizar('plan1', 'n1', { nombre: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reemplaza los alimentos de un tiempo de comida', async () => {
      prisma.tiempoComida.findUnique.mockResolvedValue({ id: 't1' });
      prisma.alimento.count.mockResolvedValue(1);
      await svc.reemplazarItems('plan1', 'DESAYUNO', 'n1', {
        items: [{ alimentoId: 'a1', porciones: 1.5 }],
      });
      expect(prisma.planItem.deleteMany).toHaveBeenCalledWith({
        where: { tiempoComidaId: 't1' },
      });
      expect(prisma.planItem.createMany).toHaveBeenCalledWith({
        data: [{ alimentoId: 'a1', porciones: 1.5, tiempoComidaId: 't1' }],
      });
    });

    it('rechaza alimentos inexistentes', async () => {
      prisma.tiempoComida.findUnique.mockResolvedValue({ id: 't1' });
      prisma.alimento.count.mockResolvedValue(0);
      await expect(
        svc.reemplazarItems('plan1', 'DESAYUNO', 'n1', {
          items: [{ alimentoId: 'zz', porciones: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.planItem.deleteMany).not.toHaveBeenCalled();
    });

    it('responde 404 si el plan no tiene ese tiempo de comida', async () => {
      prisma.tiempoComida.findUnique.mockResolvedValue(null);
      await expect(
        svc.reemplazarItems('plan1', 'CENA', 'n1', { items: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('activar y eliminar', () => {
    it('activa el plan y archiva el activo anterior', async () => {
      prisma.planAlimenticio.findFirst.mockResolvedValue({
        id: 'plan1',
        pacienteId: 'p1',
        estado: 'BORRADOR',
      });
      await svc.activar('plan1', 'n1');
      expect(prisma.planAlimenticio.updateMany).toHaveBeenCalledWith({
        where: { pacienteId: 'p1', estado: 'ACTIVO', NOT: { id: 'plan1' } },
        data: { estado: 'ARCHIVADO' },
      });
      const { data } = prisma.planAlimenticio.update.mock.calls[0][0];
      expect(data.estado).toBe('ACTIVO');
      expect(data.aprobadoEn).toBeInstanceOf(Date);
    });

    it('no activa planes archivados', async () => {
      prisma.planAlimenticio.findFirst.mockResolvedValue({
        id: 'plan1',
        estado: 'ARCHIVADO',
      });
      await expect(svc.activar('plan1', 'n1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('solo elimina borradores', async () => {
      prisma.planAlimenticio.findFirst.mockResolvedValue({
        id: 'plan1',
        estado: 'ACTIVO',
      });
      await expect(svc.eliminar('plan1', 'n1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.planAlimenticio.delete).not.toHaveBeenCalled();
    });

    it('no deja tocar planes de otra nutricionista', async () => {
      prisma.planAlimenticio.findFirst.mockResolvedValue(null);
      await expect(svc.activar('plan1', 'otra')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
