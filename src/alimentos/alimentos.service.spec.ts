import { ConflictException, NotFoundException } from '@nestjs/common';
import { aFecha, hoyIso } from '../common/fechas.js';
import {
  crearPrismaMock,
  errorUnico,
  type PrismaMock,
} from '../testing/prisma-mock.js';
import { AlimentosService } from './alimentos.service.js';

/** Alimento tal como lo devuelve Prisma, con sus valores vigentes. */
const ALIMENTO = {
  id: 'a1',
  nombre: 'Baleada sencilla',
  categoria: 'PLATO_TIPICO' as const,
  porcionDescripcion: '1 unidad',
  porcionGramos: 120,
  kcal: 330,
  proteinaG: 11,
  carbohidratoG: 42,
  grasaG: 13,
  fibraG: 2.5,
  sodioMg: 420,
  potasioMg: 610,
  fosforoMg: 180,
  azucaresG: 6,
  grasasSatG: 3.5,
  indiceGlucemico: 55,
  tiposComida: ['DESAYUNO' as const],
  contiene: [],
  esTipicoHn: true,
  fuente: 'Tabla de Composición de Alimentos INCAP',
  activo: true,
};

const HOY = aFecha(hoyIso());

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

  it('al crear el alimento guarda su versión 1 vigente', async () => {
    prisma.alimento.create.mockResolvedValue(ALIMENTO);
    prisma.alimentoVersion.create.mockResolvedValue({ id: 'v1' });

    const creado = await svc.crear({
      nombre: 'Baleada sencilla',
      categoria: 'PLATO_TIPICO',
      porcionDescripcion: '1 unidad',
      porcionGramos: 120,
      kcal: 330,
      proteinaG: 11,
      carbohidratoG: 42,
      grasaG: 13,
      tiposComida: ['DESAYUNO'],
    });

    expect(creado).toBe(ALIMENTO);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.alimentoVersion.create.mock.calls[0][0].data).toEqual({
      alimentoId: 'a1',
      version: 1,
      tabla: 'Inicial',
      vigenteDesde: HOY,
      fuente: ALIMENTO.fuente,
      porcionDescripcion: '1 unidad',
      porcionGramos: 120,
      kcal: 330,
      proteinaG: 11,
      carbohidratoG: 42,
      grasaG: 13,
      fibraG: 2.5,
      sodioMg: 420,
      potasioMg: 610,
      fosforoMg: 180,
      azucaresG: 6,
      grasasSatG: 3.5,
      indiceGlucemico: 55,
    });
  });

  it('al editar un valor nutricional crea la versión siguiente y cierra la anterior', async () => {
    prisma.alimento.findUnique.mockResolvedValue(ALIMENTO);
    prisma.alimentoVersion.findFirst.mockResolvedValue({
      id: 'v1',
      version: 1,
    });
    prisma.alimento.update.mockResolvedValue({ ...ALIMENTO, kcal: 340 });
    prisma.alimentoVersion.create.mockResolvedValue({ id: 'v2' });

    const actualizado = await svc.actualizar('a1', { kcal: 340 });

    expect(actualizado.kcal).toBe(340);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.alimentoVersion.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { vigenteHasta: HOY },
    });
    const version = prisma.alimentoVersion.create.mock.calls[0][0].data;
    expect(version).toMatchObject({
      alimentoId: 'a1',
      version: 2,
      vigenteDesde: HOY,
      kcal: 340,
    });
    expect(version.vigenteHasta).toBeUndefined();
  });

  it('al editar solo el nombre actualiza el alimento sin crear versión', async () => {
    prisma.alimento.findUnique.mockResolvedValue(ALIMENTO);
    prisma.alimento.update.mockResolvedValue({
      ...ALIMENTO,
      nombre: 'Baleada con aguacate',
    });

    const actualizado = await svc.actualizar('a1', {
      nombre: 'Baleada con aguacate',
    });

    expect(actualizado.nombre).toBe('Baleada con aguacate');
    expect(prisma.alimento.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { nombre: 'Baleada con aguacate' },
    });
    expect(prisma.alimentoVersion.findFirst).not.toHaveBeenCalled();
    expect(prisma.alimentoVersion.create).not.toHaveBeenCalled();
    expect(prisma.alimentoVersion.update).not.toHaveBeenCalled();
  });

  it('el historial de versiones viene de la más nueva a la más vieja', async () => {
    prisma.alimento.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.alimentoVersion.findMany.mockResolvedValue([
      { version: 2, vigenteHasta: null },
      { version: 1, vigenteHasta: HOY },
    ]);

    const historial = await svc.versiones('a1');

    expect(historial.map((v) => v.version)).toEqual([2, 1]);
    expect(prisma.alimentoVersion.findMany.mock.calls[0][0]).toMatchObject({
      where: { alimentoId: 'a1' },
      orderBy: { version: 'desc' },
    });
  });

  it('responde 404 al pedir el historial de un alimento inexistente', async () => {
    prisma.alimento.findUnique.mockResolvedValue(null);
    await expect(svc.versiones('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.alimentoVersion.findMany).not.toHaveBeenCalled();
  });
});
