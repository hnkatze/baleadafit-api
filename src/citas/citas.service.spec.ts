import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { CitasService } from './citas.service.js';

describe('CitasService', () => {
  let prisma: PrismaMock;
  let svc: CitasService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    svc = new CitasService(prisma, new AccesoService(prisma));
    prisma.paciente.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.cita.findMany.mockResolvedValue([]);
  });

  it('filtra la agenda por rango, paciente y estado', async () => {
    await svc.listar('n1', {
      desde: '2026-11-01T00:00:00Z',
      hasta: '2026-11-30T00:00:00Z',
      pacienteId: 'p1',
      estado: 'PROGRAMADA',
    });
    expect(prisma.cita.findMany.mock.calls[0][0].where).toEqual({
      nutricionistaId: 'n1',
      pacienteId: 'p1',
      estado: 'PROGRAMADA',
      fechaHora: {
        gte: new Date('2026-11-01T00:00:00Z'),
        lte: new Date('2026-11-30T00:00:00Z'),
      },
    });
  });

  it('programa una cita con 45 minutos por defecto', async () => {
    await svc.crear('n1', {
      pacienteId: 'p1',
      fechaHora: '2030-11-03T15:00:00-06:00',
    });
    const { data } = prisma.cita.create.mock.calls[0][0];
    expect(data).toMatchObject({ nutricionistaId: 'n1', duracionMin: 45 });
    expect(data.fechaHora).toEqual(new Date('2030-11-03T21:00:00Z'));
  });

  it('rechaza una cita que se traslapa con otra programada', async () => {
    prisma.cita.findMany.mockResolvedValue([
      { fechaHora: new Date('2030-11-03T21:00:00Z'), duracionMin: 45 },
    ]);
    await expect(
      svc.crear('n1', { pacienteId: 'p1', fechaHora: '2030-11-03T21:30:00Z' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cita.create).not.toHaveBeenCalled();
  });

  it('permite una cita que empieza cuando termina la anterior', async () => {
    prisma.cita.findMany.mockResolvedValue([
      { fechaHora: new Date('2030-11-03T21:00:00Z'), duracionMin: 45 },
    ]);
    await svc.crear('n1', {
      pacienteId: 'p1',
      fechaHora: '2030-11-03T21:45:00Z',
    });
    expect(prisma.cita.create).toHaveBeenCalled();
  });

  it('no agenda pacientes de otra nutricionista', async () => {
    prisma.paciente.findFirst.mockResolvedValue(null);
    await expect(
      svc.crear('n1', { pacienteId: 'p9', fechaHora: '2030-11-03T21:00:00Z' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('actualizar', () => {
    const cita = {
      id: 'c1',
      fechaHora: new Date('2030-11-03T21:00:00Z'),
      duracionMin: 45,
      estado: 'PROGRAMADA',
    };

    it('responde 404 si la cita no es de la nutricionista', async () => {
      prisma.cita.findFirst.mockResolvedValue(null);
      await expect(
        svc.actualizar('c1', 'n1', { estado: 'CANCELADA' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cancelar no revisa choques de horario', async () => {
      prisma.cita.findFirst.mockResolvedValue(cita);
      await svc.actualizar('c1', 'n1', { estado: 'CANCELADA' });
      expect(prisma.cita.findMany).not.toHaveBeenCalled();
      expect(prisma.cita.update.mock.calls[0][0].data.estado).toBe('CANCELADA');
    });

    it('al reprogramar excluye la misma cita de la revisión de choques', async () => {
      prisma.cita.findFirst.mockResolvedValue(cita);
      await svc.actualizar('c1', 'n1', { fechaHora: '2030-11-04T21:00:00Z' });
      expect(prisma.cita.findMany.mock.calls[0][0].where.id).toEqual({
        not: 'c1',
      });
    });
  });
});
