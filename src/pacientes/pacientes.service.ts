import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccesoService } from '../common/acceso.service.js';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  calcularEdad,
  calcularRequerimiento,
  imc,
} from '../nutricion/nutricion.util.js';
import {
  alertasDeFicha,
  clasificarImc,
  progresoDePeso,
  ultimaComposicion,
} from './ficha.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarMedicamentoDto,
  ActualizarPacienteDto,
  BuscarPacientesDto,
  CrearMedicamentoDto,
  CrearMedicionDto,
  CrearPacienteDto,
} from './pacientes.dto.js';
import type { PerfilClinico } from './perfil-clinico.js';

@Injectable()
export class PacientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  async listar(nutricionistaId: string, f: BuscarPacientesDto) {
    const where: Prisma.PacienteWhereInput = { nutricionistaId };
    if (!f.incluirInactivos) where.activo = true;
    if (f.q?.trim()) {
      const q = f.q.trim();
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellido: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
      ];
    }
    const pacientes = await this.prisma.paciente.findMany({
      where,
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: {
        mediciones: { orderBy: { fecha: 'desc' }, take: 1 },
        planes: {
          where: { estado: 'ACTIVO' },
          select: { id: true, nombre: true },
          take: 1,
        },
      },
    });
    return pacientes.map(({ mediciones, planes, ...p }) => ({
      ...p,
      ultimaMedicion: mediciones[0] ?? null,
      planActivo: planes[0] ?? null,
    }));
  }

  async detalle(id: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    const paciente = await this.prisma.paciente.findUnique({
      where: { id },
      include: {
        restricciones: { include: { restriccion: true } },
        condiciones: { include: { condicion: true } },
        /** Solo la medicación vigente: la baja lógica conserva el historial. */
        medicamentos: {
          where: { activo: true },
          orderBy: { creadoEn: 'desc' },
        },
        // Dos mediciones del mismo día se desempatan por alta, para que la
        // "última" que muestra el portal sea siempre la misma.
        mediciones: {
          orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
          take: 10,
        },
        citas: {
          where: { fechaHora: { gte: new Date() } },
          orderBy: { fechaHora: 'asc' },
          take: 3,
        },
        planes: {
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            nombre: true,
            estado: true,
            origen: true,
            kcalObjetivo: true,
            creadoEn: true,
          },
        },
      },
    });
    if (!paciente) return paciente;
    // Mismo contrato que el resto de la API: toda medición viaja con su IMC.
    return {
      ...paciente,
      mediciones: paciente.mediciones.map((m) => ({
        ...m,
        imc: imc(m.pesoKg, m.tallaCm),
      })),
    };
  }

  async crear(nutricionistaId: string, dto: CrearPacienteDto) {
    const {
      restricciones,
      condiciones,
      fechaNacimiento,
      fechaObjetivo,
      ...datos
    } = dto;
    const restriccionIds = await this.idsRestricciones(restricciones);
    try {
      return await this.prisma.paciente.create({
        data: {
          ...datos,
          fechaNacimiento: aFecha(fechaNacimiento),
          // Un `null` explícito borra el objetivo; `undefined` lo deja como está.
          ...(fechaObjetivo === undefined
            ? {}
            : { fechaObjetivo: fechaObjetivo ? aFecha(fechaObjetivo) : null }),
          nutricionistaId,
          restricciones: {
            create: restriccionIds.map((restriccionId) => ({ restriccionId })),
          },
          ...(condiciones
            ? {
                condiciones: {
                  create: (await this.idsCondiciones(condiciones)).map(
                    (condicionId) => ({ condicionId }),
                  ),
                },
              }
            : {}),
        },
        include: {
          restricciones: { include: { restriccion: true } },
          condiciones: { include: { condicion: true } },
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Ya tienes un paciente con ese correo.');
      }
      throw e;
    }
  }

  async actualizar(
    id: string,
    nutricionistaId: string,
    dto: ActualizarPacienteDto,
  ) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    const { restricciones, condiciones, fechaNacimiento, fechaObjetivo, ...datos } =
      dto;
    return this.prisma.$transaction(async (tx) => {
      if (restricciones) {
        const ids = await this.idsRestricciones(restricciones);
        await tx.pacienteRestriccion.deleteMany({ where: { pacienteId: id } });
        await tx.pacienteRestriccion.createMany({
          data: ids.map((restriccionId) => ({ pacienteId: id, restriccionId })),
        });
      }
      if (condiciones) {
        const ids = await this.idsCondiciones(condiciones);
        await tx.pacienteCondicion.deleteMany({ where: { pacienteId: id } });
        await tx.pacienteCondicion.createMany({
          data: ids.map((condicionId) => ({ pacienteId: id, condicionId })),
        });
      }
      return tx.paciente.update({
        where: { id },
        data: {
          ...datos,
          ...(fechaNacimiento
            ? { fechaNacimiento: aFecha(fechaNacimiento) }
            : {}),
          // Un `null` explícito borra el objetivo; `undefined` lo deja como está.
          ...(fechaObjetivo === undefined
            ? {}
            : { fechaObjetivo: fechaObjetivo ? aFecha(fechaObjetivo) : null }),
        },
        include: {
          restricciones: { include: { restriccion: true } },
          condiciones: { include: { condicion: true } },
        },
      });
    });
  }

  /** Baja lógica: se conserva el historial clínico. */
  async desactivar(id: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(id, nutricionistaId);
    return this.prisma.paciente.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ─── Medicamentos ────────────────────────────────────────────────────────

  async crearMedicamento(
    pacienteId: string,
    nutricionistaId: string,
    dto: CrearMedicamentoDto,
  ) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    return this.prisma.medicamento.create({
      data: { ...dto, pacienteId },
    });
  }

  async actualizarMedicamento(
    medicamentoId: string,
    nutricionistaId: string,
    dto: ActualizarMedicamentoDto,
  ) {
    await this.medicamentoPropio(medicamentoId, nutricionistaId);
    return this.prisma.medicamento.update({
      where: { id: medicamentoId },
      data: dto,
    });
  }

  /** Baja lógica: `activo = false` conserva lo recetado en el historial. */
  async desactivarMedicamento(
    medicamentoId: string,
    nutricionistaId: string,
  ) {
    await this.medicamentoPropio(medicamentoId, nutricionistaId);
    return this.prisma.medicamento.update({
      where: { id: medicamentoId },
      data: { activo: false },
    });
  }

  // ─── Mediciones ──────────────────────────────────────────────────────────

  async mediciones(pacienteId: string, nutricionistaId: string) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    return this.listarMediciones(pacienteId);
  }

  async listarMediciones(pacienteId: string) {
    const lista = await this.prisma.medicion.findMany({
      where: { pacienteId },
      orderBy: { fecha: 'asc' },
    });
    return lista.map((m) => ({ ...m, imc: imc(m.pesoKg, m.tallaCm) }));
  }

  async agregarMedicion(
    pacienteId: string,
    nutricionistaId: string,
    dto: CrearMedicionDto,
  ) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    const { fecha, ...datos } = dto;
    const creada = await this.prisma.medicion.create({
      data: { ...datos, pacienteId, fecha: aFecha(fecha ?? hoyIso()) },
    });
    // Mismo contrato que el listado: la respuesta documentada incluye el IMC.
    return { ...creada, imc: imc(creada.pesoKg, creada.tallaCm) };
  }

  async eliminarMedicion(medicionId: string, nutricionistaId: string) {
    const m = await this.prisma.medicion.findFirst({
      where: { id: medicionId, paciente: { nutricionistaId } },
    });
    if (!m) throw new NotFoundException('Medición no encontrada.');
    await this.prisma.medicion.delete({ where: { id: medicionId } });
  }

  /** Requerimiento calórico con la medición más reciente (Mifflin-St Jeor). */
  async requerimiento(pacienteId: string, nutricionistaId: string) {
    const paciente = await this.acceso.pacienteDeNutricionista(
      pacienteId,
      nutricionistaId,
    );
    const medicion = await this.prisma.medicion.findFirst({
      where: { pacienteId },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
    });
    if (!medicion) {
      throw new BadRequestException(
        'El paciente necesita al menos una medición (peso y talla).',
      );
    }
    return {
      medicion,
      ...calcularRequerimiento({
        pesoKg: medicion.pesoKg,
        tallaCm: medicion.tallaCm,
        fechaNacimiento: paciente.fechaNacimiento,
        sexo: paciente.sexo,
        nivelActividad: paciente.nivelActividad,
        meta: paciente.meta,
      }),
    };
  }

  /**
   * Contexto del expediente para el recomendador. Solo lo que existe: lo que el
   * paciente no tiene cargado no viaja (la IA no debe inventarlo).
   */
  async contextoClinico(
    pacienteId: string,
    nutricionistaId: string,
  ): Promise<PerfilClinico> {
    const paciente = await this.acceso.pacienteDeNutricionista(
      pacienteId,
      nutricionistaId,
    );
    const [condiciones, medicamentos, medicion] = await Promise.all([
      this.prisma.pacienteCondicion.findMany({
        where: { pacienteId },
        include: { condicion: { select: { nombre: true, descripcion: true } } },
      }),
      this.prisma.medicamento.findMany({
        where: { pacienteId, activo: true },
        select: { nombre: true, dosis: true, frecuencia: true },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.medicion.findFirst({
        where: { pacienteId },
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      }),
    ]);

    return {
      edad: calcularEdad(paciente.fechaNacimiento),
      sexo: paciente.sexo,
      pesoKg: medicion?.pesoKg,
      tallaCm: medicion?.tallaCm,
      imc: medicion ? imc(medicion.pesoKg, medicion.tallaCm) : undefined,
      pctGrasa: medicion?.pctGrasa ?? null,
      masaMuscularKg: medicion?.masaMuscularKg ?? null,
      grasaVisceral: medicion?.grasaVisceral ?? null,
      estadoFisiologico: paciente.estadoFisiologico,
      condiciones: condiciones.map((c) => ({
        nombre: c.condicion.nombre,
        descripcion: c.condicion.descripcion,
      })),
      alergias: paciente.alergias,
      medicamentos: medicamentos.map((m) =>
        [m.nombre, m.dosis, m.frecuencia].filter(Boolean).join(' '),
      ),
      habitos: {
        comidasAlDia: paciente.comidasAlDia,
        aguaLitros: paciente.aguaLitros,
        horasSueno: paciente.horasSueno,
        alcohol: paciente.alcohol,
        tabaco: paciente.tabaco,
        quienCocina: paciente.quienCocina,
        presupuesto: paciente.presupuesto,
      },
      objetivo: {
        pesoKg: paciente.pesoObjetivoKg,
        fecha: paciente.fechaObjetivo
          ? paciente.fechaObjetivo.toISOString().slice(0, 10)
          : null,
        meta: paciente.meta,
      },
    };
  }

  /**
   * Ficha completa del paciente para la pantalla del portal: una sola lectura con
   * los indicadores derivados y las alertas calculadas acá, no en el cliente.
   */
  async ficha(pacienteId: string, nutricionistaId: string) {
    const paciente = await this.acceso.pacienteDeNutricionista(
      pacienteId,
      nutricionistaId,
    );
    const hoy = aFecha(hoyIso());

    const [
      condiciones,
      medicamentos,
      restricciones,
      mediciones,
      proximas,
      pasadas,
      planes,
    ] = await Promise.all([
      this.prisma.pacienteCondicion.findMany({
        where: { pacienteId },
        include: { condicion: true },
      }),
      this.prisma.medicamento.findMany({
        where: { pacienteId, activo: true },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.pacienteRestriccion.findMany({
        where: { pacienteId },
        include: { restriccion: true },
      }),
      this.prisma.medicion.findMany({
        where: { pacienteId },
        orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }],
      }),
      this.prisma.cita.findMany({
        where: { pacienteId, fechaHora: { gte: new Date() } },
        orderBy: { fechaHora: 'asc' },
        take: 3,
      }),
      this.prisma.cita.findMany({
        where: { pacienteId, fechaHora: { lt: new Date() } },
        orderBy: { fechaHora: 'desc' },
        take: 5,
      }),
      this.prisma.planAlimenticio.findMany({
        where: { pacienteId },
        orderBy: { creadoEn: 'desc' },
        include: {
          tiempos: {
            select: {
              items: {
                select: { alimentoVersion: { select: { tabla: true } } },
              },
            },
          },
        },
      }),
    ]);

    const conImc = mediciones.map((m) => ({
      ...m,
      imc: imc(m.pesoKg, m.tallaCm),
    }));
    const ultima = conImc[conImc.length - 1];
    const activo = planes.find((p) => p.estado === 'ACTIVO') ?? null;

    // La última medición puede ser un control de peso sin bioimpedancia: se usa
    // la última que sí trae composición, con su fecha, para no borrar el dato.
    const composicion = ultimaComposicion(conImc);
    const masaMagraKg = ultima
      ? composicion.masaGrasaKg != null
        ? Math.round((ultima.pesoKg - composicion.masaGrasaKg) * 10) / 10
        : composicion.pctGrasa != null
          ? Math.round(ultima.pesoKg * (1 - composicion.pctGrasa / 100) * 10) /
            10
          : null
      : null;

    const adherencia = await this.adherencia(pacienteId, nutricionistaId);
    const requerimiento = await this.requerimiento(
      pacienteId,
      nutricionistaId,
    ).catch(() => null);

    const progreso = progresoDePeso(
      conImc.map((m) => ({ fecha: m.fecha, pesoKg: m.pesoKg })),
      {
        pesoKg: paciente.pesoObjetivoKg,
        fecha: paciente.fechaObjetivo,
      },
      hoy,
    );

    const alertas = alertasDeFicha({
      hoy,
      meta: paciente.meta,
      mediciones: conImc.map((m) => ({ fecha: m.fecha, pesoKg: m.pesoKg })),
      planActivo: activo ? { creadoEn: activo.creadoEn } : null,
      adherencia: {
        porcentaje: adherencia.adherencia,
        total: adherencia.totalRegistros,
      },
    });

    return {
      paciente,
      cabecera: {
        edad: calcularEdad(paciente.fechaNacimiento, hoy),
        imc: ultima ? ultima.imc : null,
        clasificacionImc: ultima ? clasificarImc(ultima.imc) : null,
        pctGrasa: composicion.pctGrasa,
        masaGrasaKg: composicion.masaGrasaKg,
        masaMuscularKg: composicion.masaMuscularKg,
        grasaVisceral: composicion.grasaVisceral,
        composicionFecha: composicion.fecha,
        masaMagraKg,
        ultimaMedicion: ultima ? { fecha: ultima.fecha } : null,
        objetivo: {
          pesoKg: paciente.pesoObjetivoKg,
          fecha: paciente.fechaObjetivo,
          meta: paciente.meta,
        },
      },
      progreso,
      situacion: {
        condiciones,
        restricciones,
        medicacion: medicamentos,
        estadoFisiologico: paciente.estadoFisiologico,
        alergias: paciente.alergias,
        cirugias: paciente.cirugias,
        suplementos: paciente.suplementos,
        motivoConsulta: paciente.motivoConsulta,
      },
      habitos: {
        comidasAlDia: paciente.comidasAlDia,
        aguaLitros: paciente.aguaLitros,
        horasSueno: paciente.horasSueno,
        alcohol: paciente.alcohol,
        tabaco: paciente.tabaco,
        quienCocina: paciente.quienCocina,
        presupuesto: paciente.presupuesto,
      },
      requerimiento,
      adherencia30d: {
        desde: adherencia.desde,
        hasta: adherencia.hasta,
        porcentaje: adherencia.adherencia,
        cumplidos: adherencia.cumplidos,
        total: adherencia.totalRegistros,
      },
      alertas,
      evolucion: conImc,
      consultas: { proximas, pasadas },
      planes: planes.map(({ tiempos, ...plan }) => ({
        ...plan,
        tablas: [
          ...new Set(
            tiempos
              .flatMap((t) => t.items)
              .map((i) => i.alimentoVersion?.tabla)
              .filter((t): t is string => !!t),
          ),
        ],
      })),
    };
  }

  // ─── Diario del paciente (vista de la nutricionista) ────────────────────

  async adherencia(
    pacienteId: string,
    nutricionistaId: string,
    desde?: string,
    hasta?: string,
  ) {
    await this.acceso.pacienteDeNutricionista(pacienteId, nutricionistaId);
    const fin = hasta ? aFecha(hasta) : aFecha(hoyIso());
    const inicio = desde ? aFecha(desde) : sumarDias(fin, -13);
    const registros = await this.prisma.registroComida.findMany({
      where: { pacienteId, fecha: { gte: inicio, lte: fin } },
      orderBy: [{ fecha: 'desc' }],
      include: { tiempoComida: { select: { tipo: true } } },
    });
    const cumplidos = registros.filter((r) => r.cumplido).length;
    return {
      desde: inicio,
      hasta: fin,
      totalRegistros: registros.length,
      cumplidos,
      adherencia: registros.length
        ? Math.round((cumplidos / registros.length) * 100) / 100
        : null,
      registros,
    };
  }

  private async idsRestricciones(codigos?: string[]): Promise<string[]> {
    if (!codigos?.length) return [];
    const encontradas = await this.prisma.restriccion.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true, codigo: true },
    });
    const faltantes = codigos.filter(
      (c) => !encontradas.some((r) => r.codigo === c),
    );
    if (faltantes.length) {
      throw new BadRequestException(
        `Restricciones desconocidas: ${faltantes.join(', ')}`,
      );
    }
    return encontradas.map((r) => r.id);
  }

  private async idsCondiciones(codigos?: string[]): Promise<string[]> {
    if (!codigos?.length) return [];
    const encontradas = await this.prisma.condicion.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true, codigo: true },
    });
    const faltantes = codigos.filter(
      (c) => !encontradas.some((cond) => cond.codigo === c),
    );
    if (faltantes.length) {
      throw new BadRequestException(
        `Condiciones desconocidas: ${faltantes.join(', ')}`,
      );
    }
    return encontradas.map((c) => c.id);
  }

  /**
   * Devuelve el medicamento solo si pertenece a un paciente de la nutricionista.
   * El mensaje es el mismo para inexistente y ajeno: no se filtra información.
   */
  private async medicamentoPropio(
    medicamentoId: string,
    nutricionistaId: string,
  ) {
    const medicamento = await this.prisma.medicamento.findUnique({
      where: { id: medicamentoId },
    });
    if (!medicamento) {
      throw new NotFoundException('Medicamento no encontrado.');
    }
    await this.acceso.pacienteDeNutricionista(
      medicamento.pacienteId,
      nutricionistaId,
    );
    return medicamento;
  }
}
