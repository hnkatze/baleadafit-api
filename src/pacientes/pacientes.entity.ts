/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';
import {
  EstadoCita,
  EstadoPlan,
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
  notas: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export class PacienteConRestriccionesEntity extends PacienteEntity {
  restricciones: PacienteRestriccionEntity[];
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

export class CitaBasicaEntity {
  id: string;
  pacienteId: string;
  nutricionistaId: string;
  fechaHora: Date;
  /** @example 45 */
  duracionMin: number;
  /** @example "Control mensual" */
  motivo: string | null;
  @ApiProperty({ enum: EstadoCita, enumName: 'EstadoCita' })
  estado: EstadoCita;
  notas: string | null;
  creadoEn: Date;
}

export class PacienteDetalleEntity extends PacienteConRestriccionesEntity {
  /** Últimas 10 mediciones, de la más reciente a la más antigua. */
  mediciones: MedicionEntity[];
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
