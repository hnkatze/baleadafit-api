import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  crearPrismaMock,
  errorUnico,
  type PrismaMock,
} from '../testing/prisma-mock.js';
import { AlimentosService } from './alimentos.service.js';

describe('AlimentosService', () => {
  let prisma: PrismaMock;
  let svc: AlimentosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    svc = new AlimentosService(prisma);
    prisma.alimento.findMany.mockResolvedValue([]);
  });

  it('arma el filtro con texto, categoría, tiempo de comida, típicos y exclusiones', async () => {
    await svc.listar({
      q: 'baleada',
      categoria: 'PLATO_TIPICO',
      tipoComida: 'DESAYUNO',
      soloTipicos: true,
      excluir: ['lactosa', 'gluten'],
    });
    expect(prisma.alimento.findMany.mock.calls[0][0].where).toEqual({
      activo: true,
      nombre: { contains: 'baleada', mode: 'insensitive' },
      categoria: 'PLATO_TIPICO',
      tiposComida: { has: 'DESAYUNO' },
      esTipicoHn: true,
      NOT: { contiene: { hasSome: ['lactosa', 'gluten'] } },
    });
  });

  it('el catálogo del paciente excluye sus restricciones', async () => {
    prisma.pacienteRestriccion.findMany.mockResolvedValue([
      { restriccion: { codigo: 'cerdo' } },
    ]);
    const r = await svc.catalogoParaPaciente('p1');
    expect(r.restricciones).toEqual(['cerdo']);
    expect(prisma.alimento.findMany.mock.calls[0][0].where.NOT).toEqual({
      contiene: { hasSome: ['cerdo'] },
    });
  });

  it('lista el catálogo de condiciones clínicas por nombre', async () => {
    prisma.condicion.findMany.mockResolvedValue([]);
    await svc.condiciones();
    expect(prisma.condicion.findMany).toHaveBeenCalledWith({
      orderBy: { nombre: 'asc' },
    });
  });

  it('responde 409 con nombre duplicado', async () => {
    prisma.alimento.create.mockRejectedValue(errorUnico());
    await expect(
      svc.crear({
        nombre: 'Baleada sencilla',
        categoria: 'PLATO_TIPICO',
        porcionDescripcion: '1 unidad',
        porcionGramos: 120,
        kcal: 330,
        proteinaG: 11,
        carbohidratoG: 42,
        grasaG: 13,
        tiposComida: ['DESAYUNO'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('responde 404 al editar un alimento inexistente', async () => {
    prisma.alimento.findUnique.mockResolvedValue(null);
    await expect(svc.actualizar('x', { kcal: 100 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.alimento.update).not.toHaveBeenCalled();
  });
});
