import { NotFoundException } from '@nestjs/common';
import type { PlanesService } from '../planes/planes.service.js';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { MiCuentaService } from './mi-cuenta.service.js';

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
      totales: { kcal: 1790 },
      tiempos: [{ id: 't1' }, { id: 't2' }],
    });
    prisma.registroComida.findMany.mockResolvedValue([
      { tiempoComidaId: 't1', cumplido: true },
    ]);
    prisma.cita.findFirst.mockResolvedValue({ id: 'c1' });

    const r = await svc.hoy('p1', '2026-10-28');

    expect(prisma.registroComida.findMany).toHaveBeenCalledWith({
      where: { pacienteId: 'p1', fecha: new Date('2026-10-28T00:00:00.000Z') },
    });
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

    it('crea o actualiza el registro del día', async () => {
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
        },
        update: { cumplido: false, comentario: 'No pude' },
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
