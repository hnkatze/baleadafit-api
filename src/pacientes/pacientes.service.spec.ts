import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import {
  crearPrismaMock,
  errorUnico,
  type PrismaMock,
} from '../testing/prisma-mock.js';
import { PacientesService } from './pacientes.service.js';

const paciente = {
  id: 'p1',
  nutricionistaId: 'n1',
  sexo: 'F',
  fechaNacimiento: new Date('1995-04-10T00:00:00Z'),
  nivelActividad: 'LIGERO',
  meta: 'BAJAR',
};

describe('PacientesService', () => {
  let prisma: PrismaMock;
  let svc: PacientesService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    svc = new PacientesService(prisma, new AccesoService(prisma));
    prisma.paciente.findFirst.mockResolvedValue(paciente);
  });

  describe('listar', () => {
    it('filtra por nutricionista, activos y texto, y aplana última medición y plan activo', async () => {
      prisma.paciente.findMany.mockResolvedValue([
        { id: 'p1', mediciones: [{ pesoKg: 70 }], planes: [] },
      ]);
      const r = await svc.listar('n1', { q: ' López ' });
      const where = prisma.paciente.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ nutricionistaId: 'n1', activo: true });
      expect(where.OR).toHaveLength(3);
      expect(where.OR[1]).toEqual({
        apellido: { contains: 'López', mode: 'insensitive' },
      });
      expect(r).toEqual([
        { id: 'p1', ultimaMedicion: { pesoKg: 70 }, planActivo: null },
      ]);
    });

    it('incluye inactivos si se pide', async () => {
      prisma.paciente.findMany.mockResolvedValue([]);
      await svc.listar('n1', { incluirInactivos: true });
      expect(prisma.paciente.findMany.mock.calls[0][0].where).toEqual({
        nutricionistaId: 'n1',
      });
    });
  });

  describe('crear', () => {
    const dto = {
      nombre: 'Ana',
      apellido: 'López',
      sexo: 'F' as const,
      fechaNacimiento: '1995-04-10',
      restricciones: ['lactosa'],
    };

    it('convierte la fecha y conecta las restricciones', async () => {
      prisma.restriccion.findMany.mockResolvedValue([
        { id: 'r1', codigo: 'lactosa' },
      ]);
      prisma.paciente.create.mockResolvedValue({ id: 'p1' });
      await svc.crear('n1', dto);
      const { data } = prisma.paciente.create.mock.calls[0][0];
      expect(data.fechaNacimiento).toEqual(
        new Date('1995-04-10T00:00:00.000Z'),
      );
      expect(data.nutricionistaId).toBe('n1');
      expect(data.restricciones).toEqual({ create: [{ restriccionId: 'r1' }] });
    });

    it('rechaza códigos de restricción desconocidos', async () => {
      prisma.restriccion.findMany.mockResolvedValue([]);
      await expect(svc.crear('n1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('responde 409 si el correo ya existe para la nutricionista', async () => {
      prisma.restriccion.findMany.mockResolvedValue([
        { id: 'r1', codigo: 'lactosa' },
      ]);
      prisma.paciente.create.mockRejectedValue(errorUnico());
      await expect(svc.crear('n1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('no deja ver pacientes de otra nutricionista', async () => {
    prisma.paciente.findFirst.mockResolvedValue(null);
    await expect(svc.detalle('p1', 'otra')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.paciente.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', nutricionistaId: 'otra' },
    });
  });

  it('desactivar hace baja lógica', async () => {
    await svc.desactivar('p1', 'n1');
    expect(prisma.paciente.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { activo: false },
    });
  });

  describe('mediciones', () => {
    it('agrega IMC a cada medición', async () => {
      prisma.medicion.findMany.mockResolvedValue([
        { pesoKg: 70, tallaCm: 175 },
      ]);
      const [m] = await svc.mediciones('p1', 'n1');
      expect(m.imc).toBe(22.9);
    });

    it('usa la fecha de hoy si no se envía', async () => {
      await svc.agregarMedicion('p1', 'n1', { pesoKg: 70, tallaCm: 170 });
      const { data } = prisma.medicion.create.mock.calls[0][0];
      expect(data.fecha.toISOString().slice(0, 10)).toBe(
        new Date().toISOString().slice(0, 10),
      );
    });

    it('no elimina mediciones de pacientes ajenos', async () => {
      prisma.medicion.findFirst.mockResolvedValue(null);
      await expect(svc.eliminarMedicion('m1', 'n1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.medicion.delete).not.toHaveBeenCalled();
    });
  });

  describe('requerimiento', () => {
    it('exige al menos una medición', async () => {
      prisma.medicion.findFirst.mockResolvedValue(null);
      await expect(svc.requerimiento('p1', 'n1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('calcula con la medición más reciente', async () => {
      const medicion = { pesoKg: 72, tallaCm: 160 };
      prisma.medicion.findFirst.mockResolvedValue(medicion);
      const r = await svc.requerimiento('p1', 'n1');
      expect(r.medicion).toBe(medicion);
      expect(r.kcalObjetivo).toBeGreaterThanOrEqual(1200);
      expect(r.factorActividad).toBe(1.375);
      expect(r.ajusteMeta).toBe(-500);
    });
  });

  it('calcula la adherencia del periodo', async () => {
    prisma.registroComida.findMany.mockResolvedValue([
      { cumplido: true },
      { cumplido: true },
      { cumplido: true },
      { cumplido: false },
    ]);
    const r = await svc.adherencia('p1', 'n1', '2026-10-01', '2026-10-14');
    expect(r).toMatchObject({
      totalRegistros: 4,
      cumplidos: 3,
      adherencia: 0.75,
    });
    expect(r.desde).toEqual(new Date('2026-10-01T00:00:00.000Z'));
  });

  it('adherencia es null sin registros', async () => {
    prisma.registroComida.findMany.mockResolvedValue([]);
    const r = await svc.adherencia('p1', 'n1');
    expect(r.adherencia).toBeNull();
  });
});
