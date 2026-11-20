import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoNutricionista } from '../generated/prisma/enums.js';
import { crearPrismaMock, type PrismaMock } from '../testing/prisma-mock.js';
import { AdminService } from './admin.service.js';

/** Campos que ve el admin. Sale de acá lo que la lista devuelve, ni uno más. */
const SELECT = {
  id: true,
  nombre: true,
  correo: true,
  colegiado: true,
  telefono: true,
  estado: true,
  motivoRechazo: true,
  fechaNacimiento: true,
  creadoEn: true,
};

const LISTA = {
  where: { estado: EstadoNutricionista.PENDIENTE },
  orderBy: { creadoEn: 'asc' },
  select: SELECT,
};

describe('AdminService', () => {
  let prisma: PrismaMock;
  let svc: AdminService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    svc = new AdminService(prisma);
  });

  it('sin query lista los PENDIENTE: son los que llevan más tiempo esperando', async () => {
    prisma.nutricionista.findMany.mockResolvedValue([]);

    await expect(svc.listarNutricionistas()).resolves.toEqual([]);

    // El default no es "todos": un perfil sin revisar no se pierde entre los aprobados.
    expect(prisma.nutricionista.findMany).toHaveBeenCalledWith({
      where: { estado: EstadoNutricionista.PENDIENTE },
      // Los más viejos primero.
      orderBy: { creadoEn: 'asc' },
      // Solo estos campos: fuera `firebaseUid` y `motivoRechazo`.
      select: SELECT,
    });
  });

  it('lista los perfiles de un estado concreto', async () => {
    prisma.nutricionista.findMany.mockResolvedValue([
      { id: 'n1', estado: EstadoNutricionista.RECHAZADO },
    ]);

    const r = await svc.listarNutricionistas({
      estado: EstadoNutricionista.RECHAZADO,
    });

    expect(r).toEqual([{ id: 'n1', estado: EstadoNutricionista.RECHAZADO }]);
    expect(prisma.nutricionista.findMany).toHaveBeenCalledWith({
      ...LISTA,
      where: { estado: EstadoNutricionista.RECHAZADO },
    });
  });

  it('con un id inexistente responde 404 y no actualiza nada', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue(null);

    await expect(
      svc.cambiarEstado('no-existe', { estado: EstadoNutricionista.APROBADO }),
    ).rejects.toThrow(new NotFoundException('Nutricionista no encontrada.'));
    expect(prisma.nutricionista.update).not.toHaveBeenCalled();
  });

  it('RECHAZADO sin motivo responde 400 y no actualiza nada', async () => {
    await expect(
      svc.cambiarEstado('n1', { estado: EstadoNutricionista.RECHAZADO }),
    ).rejects.toThrow(
      new BadRequestException(
        'El motivo es obligatorio cuando el estado es RECHAZADO.',
      ),
    );
    expect(prisma.nutricionista.update).not.toHaveBeenCalled();
  });

  it('RECHAZADO con un motivo en blanco también responde 400', async () => {
    await expect(
      svc.cambiarEstado('n1', {
        estado: EstadoNutricionista.RECHAZADO,
        motivo: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.nutricionista.update).not.toHaveBeenCalled();
  });

  it('RECHAZADO persiste el motivo en `motivoRechazo`', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({ id: 'n1' });
    prisma.nutricionista.update.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.RECHAZADO,
    });

    const r = await svc.cambiarEstado('n1', {
      estado: EstadoNutricionista.RECHAZADO,
      motivo: 'Colegiatura sin verificar.',
    });

    // El `data` lleva solo lo que cambia: nada de nombre, correo ni estado de más.
    expect(prisma.nutricionista.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: {
        estado: EstadoNutricionista.RECHAZADO,
        motivoRechazo: 'Colegiatura sin verificar.',
      },
      select: SELECT,
    });
    expect(r).toEqual({
      id: 'n1',
      estado: EstadoNutricionista.RECHAZADO,
    });
  });

  it('APROBADO limpia el motivo anterior e ignora el motivo del body', async () => {
    prisma.nutricionista.findUnique.mockResolvedValue({ id: 'n1' });
    prisma.nutricionista.update.mockResolvedValue({
      id: 'n1',
      estado: EstadoNutricionista.APROBADO,
    });

    await svc.cambiarEstado('n1', {
      estado: EstadoNutricionista.APROBADO,
      motivo: 'motivo viejo que no debe quedar',
    });

    expect(prisma.nutricionista.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      // Un motivo viejo no puede contradecir un estado nuevo.
      data: { estado: EstadoNutricionista.APROBADO, motivoRechazo: null },
      select: SELECT,
    });
  });
});
