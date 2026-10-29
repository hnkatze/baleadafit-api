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

  describe('condiciones', () => {
    const dto = {
      nombre: 'Ana',
      apellido: 'López',
      sexo: 'F' as const,
      fechaNacimiento: '1995-04-10',
      condiciones: ['dm2'],
    };

    it('conecta las condiciones del catálogo al crear', async () => {
      prisma.condicion.findMany.mockResolvedValue([{ id: 'c1', codigo: 'dm2' }]);
      prisma.paciente.create.mockResolvedValue({ id: 'p1' });
      await svc.crear('n1', dto);
      const { data } = prisma.paciente.create.mock.calls[0][0];
      expect(data.condiciones).toEqual({ create: [{ condicionId: 'c1' }] });
    });

    it('rechaza códigos de condición desconocidos', async () => {
      prisma.condicion.findMany.mockResolvedValue([]);
      await expect(svc.crear('n1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.paciente.create).not.toHaveBeenCalled();
    });

    it('reemplaza el set completo de condiciones al actualizar', async () => {
      prisma.condicion.findMany.mockResolvedValue([{ id: 'c1', codigo: 'dm2' }]);
      await svc.actualizar('p1', 'n1', { condiciones: ['dm2'] });
      expect(prisma.pacienteCondicion.deleteMany).toHaveBeenCalledWith({
        where: { pacienteId: 'p1' },
      });
      expect(prisma.pacienteCondicion.createMany).toHaveBeenCalledWith({
        data: [{ pacienteId: 'p1', condicionId: 'c1' }],
      });
    });

    it('el detalle trae las condiciones completas y la medicación activa reciente', async () => {
      await svc.detalle('p1', 'n1');
      const { include } = prisma.paciente.findUnique.mock.calls[0][0];
      expect(include.condiciones).toEqual({ include: { condicion: true } });
      expect(include.medicamentos).toEqual({
        where: { activo: true },
        orderBy: { creadoEn: 'desc' },
      });
    });

    it('el detalle devuelve las mediciones con imc y desempata por fecha de alta', async () => {
      prisma.paciente.findUnique.mockResolvedValue({
        id: 'p1',
        mediciones: [
          { pesoKg: 74, tallaCm: 160 },
          { pesoKg: 73, tallaCm: 160 },
        ],
        condiciones: [],
        medicamentos: [],
        citas: [],
        planes: [],
      } as never);

      const r = await svc.detalle('p1', 'n1');
      const { include } = prisma.paciente.findUnique.mock.calls[0][0];

      // Dos mediciones del mismo día deben quedar en orden determinista.
      expect(include.mediciones.orderBy).toEqual([
        { fecha: 'desc' },
        { creadoEn: 'desc' },
      ]);
      expect(r!.mediciones.map((m) => m.imc)).toEqual([28.9, 28.5]);
    });
  });

  it('actualizar sigue reemplazando el set de restricciones', async () => {
    prisma.restriccion.findMany.mockResolvedValue([
      { id: 'r1', codigo: 'lactosa' },
    ]);
    await svc.actualizar('p1', 'n1', { restricciones: ['lactosa'] });
    expect(prisma.pacienteRestriccion.deleteMany).toHaveBeenCalledWith({
      where: { pacienteId: 'p1' },
    });
    expect(prisma.pacienteRestriccion.createMany).toHaveBeenCalledWith({
      data: [{ pacienteId: 'p1', restriccionId: 'r1' }],
    });
  });

  describe('medicamentos', () => {
    it('registra un medicamento del paciente validando el acceso', async () => {
      prisma.medicamento.create.mockResolvedValue({ id: 'med1' });
      await svc.crearMedicamento('p1', 'n1', {
        nombre: 'Metformina',
        dosis: '500 mg',
      });
      expect(prisma.medicamento.create).toHaveBeenCalledWith({
        data: { nombre: 'Metformina', dosis: '500 mg', pacienteId: 'p1' },
      });
    });

    it('no registra medicamentos para pacientes ajenos', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);
      await expect(
        svc.crearMedicamento('p9', 'n1', { nombre: 'Enalapril' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.medicamento.create).not.toHaveBeenCalled();
    });

    it('edita y da de baja lógica sin borrar el historial', async () => {
      prisma.medicamento.findUnique.mockResolvedValue({
        id: 'med1',
        pacienteId: 'p1',
      });
      await svc.actualizarMedicamento('med1', 'n1', {
        frecuencia: 'cada 24 h',
      });
      expect(prisma.medicamento.update).toHaveBeenCalledWith({
        where: { id: 'med1' },
        data: { frecuencia: 'cada 24 h' },
      });

      await svc.desactivarMedicamento('med1', 'n1');
      expect(prisma.medicamento.update).toHaveBeenLastCalledWith({
        where: { id: 'med1' },
        data: { activo: false },
      });
      expect(prisma.medicamento.delete).not.toHaveBeenCalled();
    });

    it('no permite tocar medicamentos de pacientes de otra nutricionista', async () => {
      prisma.medicamento.findUnique.mockResolvedValue({
        id: 'med1',
        pacienteId: 'p9',
      });
      prisma.paciente.findFirst.mockResolvedValue(null);
      await expect(
        svc.actualizarMedicamento('med1', 'n1', { dosis: '1 g' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.medicamento.update).not.toHaveBeenCalled();
    });

    it('responde 404 si el medicamento no existe', async () => {
      prisma.medicamento.findUnique.mockResolvedValue(null);
      await expect(
        svc.desactivarMedicamento('med-x', 'n1'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
      prisma.medicion.create.mockResolvedValue({
        pesoKg: 70,
        tallaCm: 170,
        fecha: new Date(),
      });
      await svc.agregarMedicion('p1', 'n1', { pesoKg: 70, tallaCm: 170 });
      const { data } = prisma.medicion.create.mock.calls[0][0];
      expect(data.fecha.toISOString().slice(0, 10)).toBe(
        new Date().toISOString().slice(0, 10),
      );
    });

    it('devuelve el imc al registrar, igual que el listado', async () => {
      prisma.medicion.create.mockResolvedValue({
        id: 'm1',
        pacienteId: 'p1',
        fecha: new Date('2026-10-29T00:00:00Z'),
        pesoKg: 73,
        tallaCm: 160,
        pctGrasa: null,
        cinturaCm: null,
        notas: null,
        creadoEn: new Date('2026-10-29T00:00:00Z'),
      });

      const r = await svc.agregarMedicion('p1', 'n1', {
        pesoKg: 73,
        tallaCm: 160,
      });

      expect(r.imc).toBe(28.5);
    });

    it('guarda la composición corporal y la fuente sin cambiar el contrato del imc', async () => {
      prisma.medicion.create.mockResolvedValue({
        id: 'm1',
        pacienteId: 'p1',
        fecha: new Date('2026-10-29T00:00:00Z'),
        pesoKg: 73,
        tallaCm: 160,
        masaMuscularKg: 28.4,
        grasaVisceral: 8,
        fuente: 'INBODY',
        creadoEn: new Date('2026-10-29T00:00:00Z'),
      });

      const r = await svc.agregarMedicion('p1', 'n1', {
        pesoKg: 73,
        tallaCm: 160,
        masaMuscularKg: 28.4,
        grasaVisceral: 8,
        anguloFase: 6.2,
        pliegueTricipitalMm: 18,
        perimetroBrazoCm: 30,
        presionSistolica: 120,
        presionDiastolica: 80,
        fuente: 'INBODY',
      });

      const { data } = prisma.medicion.create.mock.calls[0][0];
      expect(data).toMatchObject({
        masaMuscularKg: 28.4,
        grasaVisceral: 8,
        anguloFase: 6.2,
        pliegueTricipitalMm: 18,
        perimetroBrazoCm: 30,
        presionSistolica: 120,
        presionDiastolica: 80,
        fuente: 'INBODY',
        pacienteId: 'p1',
      });
      expect(r.imc).toBe(28.5);
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
