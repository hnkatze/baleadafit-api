/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';
import {
  EstadoCita,
  EstadoFisiologico,
  EstadoPlan,
  FuenteMedicion,
  Meta,
  NivelActividad,
  OrigenPlan,
  Sexo,
  TipoComida,
} from '../generated/prisma/enums.js';

export class RestriccionEntity {
  /** @example "7c1f6a2e-1b2c-4d5e-8f90-1234567890ab" */
  id: string;
  /**
   * Etiqueta que se compara con `alimento.contiene`.
   * @example "lactosa"
   */
  codigo: string;
  /** @example "Sin lácteos / lactosa" */
  nombre: string;
  descripcion: string | null;
}

export class PacienteRestriccionEntity {
  pacienteId: string;
  restriccionId: string;
  restriccion: RestriccionEntity;
}

export class CondicionEntity {
  /** @example "3f2a7c1e-9b4d-4a6e-8c10-abcdefabcdef" */
  id: string;
  /**
   * Se usa al crear o actualizar pacientes.
   * @example "dm2"
   */
  codigo: string;
  /** @example "Diabetes mellitus tipo 2" */
  nombre: string;
  descripcion: string | null;
}

export class PacienteCondicionEntity {
  pacienteId: string;
  condicionId: string;
  /** Detalle del caso (grado, control, desde cuándo). */
  notas: string | null;
  condicion: CondicionEntity;
}

export class MedicamentoEntity {
  id: string;
  pacienteId: string;
  /** @example "Metformina" */
  nombre: string;
  /** @example "500 mg" */
  dosis: string | null;
  /** @example "Cada 12 horas con comida" */
  frecuencia: string | null;
  /** `false` cuando se dio de baja lógica; el historial se conserva. */
  activo: boolean;
  creadoEn: Date;
}

export class MedicionEntity {
  id: string;
  pacienteId: string;
  /** @example "2026-10-28T00:00:00.000Z" */
  fecha: Date;
  /** @example 72 */
  pesoKg: number;
  /** @example 160 */
  tallaCm: number;
  /** @example 34 */
  pctGrasa: number | null;
  /** @example 88 */
  cinturaCm: number | null;
  /** @example 28.4 */
  masaMuscularKg: number | null;
  /** @example 24.6 */
  masaGrasaKg: number | null;
  /**
   * Nivel de grasa visceral que reporta el equipo (1-20).
   * @example 8
   */
  grasaVisceral: number | null;
  /** @example 18.2 */
  aguaIntracelularL: number | null;
  /** @example 12.1 */
  aguaExtracelularL: number | null;
  /** @example 6.2 */
  anguloFase: number | null;
  /** @example 18 */
  pliegueTricipitalMm: number | null;
  /** @example 16 */
  pliegueSubescapularMm: number | null;
  /** @example 22 */
  pliegueSuprailiacoMm: number | null;
  /** @example 12 */
  pliegueBicipitalMm: number | null;
  /** @example 30 */
  perimetroBrazoCm: number | null;
  /** @example 98 */
  perimetroCaderaCm: number | null;
  /** @example 55 */
  perimetroMusloCm: number | null;
  /** @example 120 */
  presionSistolica: number | null;
  /** @example 80 */
  presionDiastolica: number | null;
  @ApiProperty({ enum: FuenteMedicion, enumName: 'FuenteMedicion' })
  fuente: FuenteMedicion;
  notas: string | null;
  creadoEn: Date;
}

export class MedicionConImcEntity extends MedicionEntity {
  /**
   * Índice de masa corporal calculado.
   * @example 28.1
   */
  imc: number;
}

export class PacienteEntity {
  id: string;
  nutricionistaId: string;
  /** UID de Firebase; null hasta que el paciente inicia sesión en la app. */
  firebaseUid: string | null;
  /** @example "Ana" */
  nombre: string;
  /** @example "López" */
  apellido: string;
  /** @example "ana@correo.hn" */
  correo: string | null;
  /** @example "+504 9999-0000" */
  telefono: string | null;
  @ApiProperty({ enum: Sexo, enumName: 'Sexo' })
  sexo: Sexo;
  /** @example "1995-04-10T00:00:00.000Z" */
  fechaNacimiento: Date;
  @ApiProperty({ enum: NivelActividad, enumName: 'NivelActividad' })
  nivelActividad: NivelActividad;
  @ApiProperty({ enum: Meta, enumName: 'Meta' })
  meta: Meta;
  /**
   * Peso objetivo pactado con el paciente, en kg.
   * @example 68
   */
  pesoObjetivoKg: number | null;
  /** @example "2027-03-01T00:00:00.000Z" */
  fechaObjetivo: Date | null;
  @ApiProperty({ enum: EstadoFisiologico, enumName: 'EstadoFisiologico' })
  estadoFisiologico: EstadoFisiologico;
  /** @example "Bajar de peso sin perder masa muscular" */
  motivoConsulta: string | null;
  /** Texto libre; complementa las restricciones del catálogo. */
  alergias: string | null;
  /** @example "Apendicectomía en 2018" */
  cirugias: string | null;
  /** @example "Vitamina D 1000 UI diaria" */
  suplementos: string | null;
  /** @example 5 */
  comidasAlDia: number | null;
  /** @example 2 */
  aguaLitros: number | null;
  /** @example 7 */
  horasSueno: number | null;
  /** @example "1 cerveza los fines de semana" */
  alcohol: string | null;
  /** @example "No fuma" */
  tabaco: string | null;
  /** @example "La mamá" */
  quienCocina: string | null;
  /** @example "L 1,500 semanales" */
  presupuesto: string | null;
  notas: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export class PacienteConRestriccionesEntity extends PacienteEntity {
  restricciones: PacienteRestriccionEntity[];
}

export class PacienteConCondicionesEntity extends PacienteConRestriccionesEntity {
  condiciones: PacienteCondicionEntity[];
}

export class PlanResumenEntity {
  id: string;
  /** @example "Plan inicial" */
  nombre: string;
  @ApiProperty({ enum: EstadoPlan, enumName: 'EstadoPlan' })
  estado: EstadoPlan;
  @ApiProperty({ enum: OrigenPlan, enumName: 'OrigenPlan' })
  origen: OrigenPlan;
  /** @example 1430 */
  kcalObjetivo: number;
  creadoEn: Date;
}

export class PlanActivoRefEntity {
  id: string;
  nombre: string;
}

export class PacienteListadoEntity extends PacienteEntity {
  ultimaMedicion: MedicionEntity | null;
  planActivo: PlanActivoRefEntity | null;
}

/// Cita mínima de agenda: es lo que también ve el paciente.
export class CitaAgendaEntity {
  id: string;
  fechaHora: Date;
  /** @example 45 */
  duracionMin: number;
  /** @example "Control mensual" */
  motivo: string | null;
  @ApiProperty({ enum: EstadoCita, enumName: 'EstadoCita' })
  estado: EstadoCita;
}

/// Cita con lo clínico: notas internas, SOAP y próxima fecha. Solo la nutricionista.
export class CitaBasicaEntity extends CitaAgendaEntity {
  pacienteId: string;
  nutricionistaId: string;
  notas: string | null;
  /**
   * SOAP de la consulta: lo que el paciente refiere.
   * @example "Refiere hambre a media tarde y poca sed."
   */
  subjetivo: string | null;
  /**
   * SOAP: lo medido y observado en la consulta.
   * @example "Peso 78.4 kg, cintura 92 cm, presión 118/76."
   */
  objetivo: string | null;
  /**
   * SOAP: interpretación del caso.
   * @example "Adherencia parcial al plan; pérdida de 1.2 kg en 4 semanas."
   */
  analisis: string | null;
  /**
   * SOAP: conducta y próxima indicación.
   * @example "Agregar merienda de fruta con yogur y control en 4 semanas."
   */
  plan: string | null;
  /**
   * Fecha sugerida de la próxima cita (solo fecha).
   * @example "2026-12-01T00:00:00.000Z"
   */
  proximaCitaSugerida: Date | null;
  creadoEn: Date;
}

export class PacienteDetalleEntity extends PacienteConCondicionesEntity {
  /** Últimas 10 mediciones, de la más reciente a la más antigua, con IMC. */
  mediciones: MedicionConImcEntity[];
  /** Medicación vigente (`activo`), la más reciente primero. */
  medicamentos: MedicamentoEntity[];
  /** Próximas 3 citas. */
  citas: CitaBasicaEntity[];
  planes: PlanResumenEntity[];
}

export class DistribucionMacrosEntity {
  /** @example 0.25 */
  proteina: number;
  /** @example 0.5 */
  carbohidrato: number;
  /** @example 0.25 */
  grasa: number;
}

export class RequerimientoEntity {
  /** Medición usada para el cálculo (la más reciente). */
  medicion: MedicionEntity;
  /** @example 31 */
  edad: number;
  /**
   * Tasa metabólica basal (Mifflin-St Jeor), kcal.
   * @example 1404
   */
  tmb: number;
  /** @example 1.375 */
  factorActividad: number;
  /**
   * TMB × factor de actividad, kcal.
   * @example 1931
   */
  gastoTotal: number;
  /**
   * Ajuste por meta: −500 bajar, 0 mantener, +300 subir.
   * @example -500
   */
  ajusteMeta: number;
  /** @example 1430 */
  kcalObjetivo: number;
  /** @example 89.4 */
  proteinaG: number;
  /** @example 178.8 */
  carbohidratoG: number;
  /** @example 39.7 */
  grasaG: number;
  distribucionMacros: DistribucionMacrosEntity;
}

export class TiempoComidaTipoEntity {
  @ApiProperty({ enum: TipoComida, enumName: 'TipoComida' })
  tipo: TipoComida;
}

export class RegistroComidaEntity {
  id: string;
  pacienteId: string;
  tiempoComidaId: string;
  /** @example "2026-10-28T00:00:00.000Z" */
  fecha: Date;
  /** @example true */
  cumplido: boolean;
  /** @example "Cambié el plátano por yuca" */
  comentario: string | null;
  creadoEn: Date;
}

export class RegistroComidaConTipoEntity extends RegistroComidaEntity {
  tiempoComida: TiempoComidaTipoEntity;
}

export class AdherenciaEntity {
  desde: Date;
  hasta: Date;
  /** @example 20 */
  totalRegistros: number;
  /** @example 16 */
  cumplidos: number;
  /**
   * Cumplidos / total (0–1); null si no hay registros.
   * @example 0.8
   */
  adherencia: number | null;
  registros: RegistroComidaConTipoEntity[];
}

/// ─── Ficha del paciente ──────────────────────────────────────────────────

export class ProgresoPesoEntity {
  /** @example 76 */
  pesoInicial: number | null;
  /** @example 73.4 */
  pesoActual: number | null;
  /** @example -2.6 */
  deltaKg: number | null;
  /** Ritmo semanal; negativo si está bajando. @example -0.4 */
  ritmoKgSemana: number | null;
  /** Extrapolación lineal al objetivo; es una proyección, no una promesa. @example 68.1 */
  proyeccionKg: number | null;
}

export class AlertaFichaEntity {
  /**
   * SIN_MEDICION | PESO_ESTANCADO | SIN_PLAN_ACTIVO | PLAN_VIEJO | ADHERENCIA_BAJA
   * @example "SIN_MEDICION"
   */
  tipo: string;
  /** @example "media" */
  severidad: string;
  /** @example "Última medición hace 45 días." */
  detalle: string;
}

export class CabeceraFichaEntity {
  /** @example 31 */
  edad: number;
  /** @example 28.7 */
  imc: number | null;
  /**
   * BAJO_PESO | NORMAL | SOBREPESO | OBESIDAD_I | OBESIDAD_II | OBESIDAD_III
   * @example "SOBREPESO"
   */
  clasificacionImc: string | null;
  /** Sale de la última medición que trae composición. @example 33.5 */
  pctGrasa: number | null;
  /** @example 24.5 */
  masaGrasaKg: number | null;
  /** @example 24.8 */
  masaMuscularKg: number | null;
  /** @example 8 */
  grasaVisceral: number | null;
  /** Fecha de la medición de la que salió la composición. */
  composicionFecha: Date | null;
  /** Peso de la última medición menos masa grasa. @example 48.6 */
  masaMagraKg: number | null;
  ultimaMedicion: { fecha: Date } | null;
  objetivo: {
    pesoKg: number | null;
    fecha: Date | null;
    meta: Meta;
  };
}

export class SituacionFichaEntity {
  condiciones: PacienteCondicionEntity[];
  restricciones: PacienteRestriccionEntity[];
  medicacion: MedicamentoEntity[];
  @ApiProperty({ enum: EstadoFisiologico, enumName: 'EstadoFisiologico' })
  estadoFisiologico: EstadoFisiologico;
  alergias: string | null;
  cirugias: string | null;
  suplementos: string | null;
  motivoConsulta: string | null;
}

export class HabitosFichaEntity {
  comidasAlDia: number | null;
  aguaLitros: number | null;
  horasSueno: number | null;
  alcohol: string | null;
  tabaco: string | null;
  quienCocina: string | null;
  presupuesto: string | null;
}

export class AdherenciaFichaEntity {
  desde: Date;
  hasta: Date;
  /** Entre 0 y 1. @example 0.72 */
  porcentaje: number | null;
  /** @example 18 */
  cumplidos: number;
  total: number;
}

export class ConsultasFichaEntity {
  proximas: CitaBasicaEntity[];
  /** Consultas ya ocurridas, con su SOAP. */
  pasadas: CitaBasicaEntity[];
}

export class PlanEnFichaEntity {
  id: string;
  nombre: string;
  @ApiProperty({ enum: EstadoPlan, enumName: 'EstadoPlan' })
  estado: EstadoPlan;
  kcalObjetivo: number;
  creadoEn: Date;
  aprobadoEn: Date | null;
  /// Tablas nutricionales con las que se calcularon sus ítems.
  tablas: string[];
}

export class FichaPacienteEntity {
  paciente: PacienteEntity;
  cabecera: CabeceraFichaEntity;
  progreso: ProgresoPesoEntity;
  situacion: SituacionFichaEntity;
  habitos: HabitosFichaEntity;
  requerimiento: RequerimientoEntity | null;
  adherencia30d: AdherenciaFichaEntity;
  alertas: AlertaFichaEntity[];
  evolucion: MedicionConImcEntity[];
  consultas: ConsultasFichaEntity;
  planes: PlanEnFichaEntity[];
}
