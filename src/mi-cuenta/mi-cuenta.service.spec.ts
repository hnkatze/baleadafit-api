import { NotFoundException } from '@nestjs/common';
import type { PlanesService } from '../planes/planes.service.js';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import {
  CITA_PACIENTE_SELECT,
  MiCuentaService,
} from './mi-cuenta.service.js';

describe('MiCuentaService', () => {
  let prisma: PrismaMock;
  let planes: { detalleConTotales: ReturnType<typeof vi.fn> };
  let svc: MiCuentaService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    planes = { detalleConTotales: vi.fn() };
    svc = new MiCuentaService(prisma, planes as unknown as PlanesService);
  });

  it('plan activo es null si no hay uno', async () => {
    prisma.planAlimenticio.findFirst.mockResolvedValue(null);
    await expect(svc.planActivo('p1')).resolves.toBeNull();
    expect(planes.detalleConTotales).not.toHaveBeenCalled();
  });

  it('la pantalla Hoy une cada tiempo de comida con su registro del día', async () => {
    prisma.planAlimenticio.findFirst.mockResolvedValue({ id: 'plan1' });
    planes.detalleConTotales.mockResolvedValue({
      id: 'plan1',
      nombre: 'Plan A',
      kcalObjetivo: 1800,
      totales: { kcal: 12000 },
      dias: [
        {
          dia: 'MIERCOLES',
          tiempos: [{ id: 't1' }, { id: 't2' }],
          totales: { kcal: 1790 },
          desviacion: -0.005,
        },
        {
          dia: 'JUEVES',
          tiempos: [{ id: 't9' }],
          totales: { kcal: 1700 },
          desviacion: -0.05,
        },
      ],
    });
    prisma.registroComida.findMany.mockResolvedValue([
      { tiempoComidaId: 't1', cumplido: true },
    ]);
    prisma.cita.findFirst.mockResolvedValue({ id: 'c1' });

    const r = await svc.hoy('p1', '2026-10-28');

    expect(prisma.registroComida.findMany).toHaveBeenCalledWith({
      where: { pacienteId: 'p1', fecha: new Date('2026-10-28T00:00:00.000Z') },
    });
    // Solo el día de la fecha pedida: los demás días de la semana no se mezclan.
    expect(r.dia).toBe('MIERCOLES');
    expect(r.plan).toEqual({
      id: 'plan1',
      nombre: 'Plan A',
      kcalObjetivo: 1800,
      totales: { kcal: 1790 },
    });
    expect(r.tiempos.map((t) => t.registro?.cumplido ?? null)).toEqual([
      true,
      null,
    ]);
    expect(r.cumplidos).toBe(1);
    expect(r.proximaCita).toEqual({ id: 'c1' });
  });

  it('la pantalla Hoy de un plan de un solo día sigue mostrando ese día', async () => {
    // Los planes anteriores a la semana tienen todas sus filas en LUNES.
    prisma.planAlimenticio.findFirst.mockResolvedValue({ id: 'plan1' });
    planes.detalleConTotales.mockResolvedValue({
      id: 'plan1',
      nombre: 'Plan viejo',
      kcalObjetivo: 1800,
      totales: { kcal: 1800 },
      dias: [
        {
          dia: 'LUNES',
          tiempos: [{ id: 't1' }],
          totales: { kcal: 1800 },
          desviacion: 0,
        },
      ],
    });
    prisma.registroComida.findMany.mockResolvedValue([]);
    prisma.cita.findFirst.mockResolvedValue(null);

    const r = await svc.hoy('p1', '2026-10-28');

    expect(r.dia).toBe('MIERCOLES');
    expect(r.tiempos).toHaveLength(1);
    expect(r.plan?.totales).toEqual({ kcal: 1800 });
  });

  it('la pantalla Hoy no inventa comidas si el plan no tiene ese día', async () => {
    prisma.planAlimenticio.findFirst.mockResolvedValue({ id: 'plan1' });
    planes.detalleConTotales.mockResolvedValue({
      id: 'plan1',
      nombre: 'Plan A',
      kcalObjetivo: 1800,
      totales: { kcal: 12000 },
      dias: [
        { dia: 'LUNES', tiempos: [{ id: 't1' }], totales: { kcal: 1 }, desviacion: 0 },
        { dia: 'MARTES', tiempos: [{ id: 't2' }], totales: { kcal: 1 }, desviacion: 0 },
      ],
    });
    prisma.registroComida.findMany.mockResolvedValue([]);
    prisma.cita.findFirst.mockResolvedValue(null);

    const r = await svc.hoy('p1', '2026-10-28');

    expect(r.tiempos).toEqual([]);
    expect(r.cumplidos).toBe(0);
  });

  it('la pantalla Hoy no expone notas internas ni SOAP en la próxima cita', async () => {
    prisma.planAlimenticio.findFirst.mockResolvedValue(null);
    prisma.registroComida.findMany.mockResolvedValue([]);
    prisma.cita.findFirst.mockResolvedValue({ id: 'c1' });

    await svc.hoy('p1', '2026-10-28');

    const { select } = prisma.cita.findFirst.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual([
      'duracionMin',
      'estado',
      'fechaHora',
      'id',
      'motivo',
    ]);
  });

  it('el listado de citas del paciente tampoco expone notas ni SOAP', async () => {
    prisma.cita.findMany.mockResolvedValue([]);

    await svc.citas('p1');

    const { select } = prisma.cita.findMany.mock.calls[0][0];
    for (const interno of ['notas', 'subjetivo', 'objetivo', 'analisis', 'plan']) {
      expect(select).not.toHaveProperty(interno);
    }
    expect(select).toMatchObject({ id: true, fechaHora: true, motivo: true });
  });

  it('el select del paciente no declara ningún campo interno', () => {
    expect(Object.keys(CITA_PACIENTE_SELECT).sort()).toEqual([
      'duracionMin',
      'estado',
      'fechaHora',
      'id',
      'motivo',
    ]);
  });

  it('la pantalla Hoy funciona sin plan activo', async () => {
    prisma.planAlimenticio.findFirst.mockResolvedValue(null);
    prisma.registroComida.findMany.mockResolvedValue([]);
    prisma.cita.findFirst.mockResolvedValue(null);
    const r = await svc.hoy('p1', '2026-10-28');
    expect(r).toMatchObject({ plan: null, tiempos: [], cumplidos: 0 });
  });

  describe('registrar comida', () => {
    it('solo acepta tiempos de comida de los planes del paciente', async () => {
      prisma.tiempoComida.findFirst.mockResolvedValue(null);
      await expect(
        svc.registrar('p1', { tiempoComidaId: 't9', cumplido: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tiempoComida.findFirst).toHaveBeenCalledWith({
        where: { id: 't9', plan: { pacienteId: 'p1' } },
      });
    });

    it('crea o actualiza el registro del día con autoría del paciente', async () => {
      prisma.tiempoComida.findFirst.mockResolvedValue({ id: 't1' });
      await svc.registrar('p1', {
        tiempoComidaId: 't1',
        fecha: '2026-10-28',
        cumplido: false,
        comentario: 'No pude',
      });
      const fecha = new Date('2026-10-28T00:00:00.000Z');
      expect(prisma.registroComida.upsert).toHaveBeenCalledWith({
        where: {
          pacienteId_tiempoComidaId_fecha: {
            pacienteId: 'p1',
            tiempoComidaId: 't1',
            fecha,
          },
        },
        create: {
          pacienteId: 'p1',
          tiempoComidaId: 't1',
          fecha,
          cumplido: false,
          comentario: 'No pude',
          autor: 'PACIENTE',
        },
        update: {
          cumplido: false,
          comentario: 'No pude',
          autor: 'PACIENTE',
        },
      });
    });

    it('volver a marcar una comida corregida por la nutricionista devuelve la autoría al paciente', async () => {
      prisma.tiempoComida.findFirst.mockResolvedValue({ id: 't1' });
      await svc.registrar('p1', {
        tiempoComidaId: 't1',
        fecha: '2026-10-28',
        cumplido: true,
      });
      expect(prisma.registroComida.upsert.mock.calls[0][0].update).toMatchObject({
        autor: 'PACIENTE',
      });
    });
  });

  it('el diario por defecto cubre los últimos 7 días', async () => {
    prisma.registroComida.findMany.mockResolvedValue([]);
    await svc.registros('p1', undefined, '2026-10-28');
    expect(prisma.registroComida.findMany.mock.calls[0][0].where.fecha).toEqual(
      {
        gte: new Date('2026-10-22T00:00:00.000Z'),
        lte: new Date('2026-10-28T00:00:00.000Z'),
      },
    );
  });
});
