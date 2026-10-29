/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import {
  CitaAgendaEntity,
  RegistroComidaEntity,
} from '../pacientes/pacientes.entity.js';
import { TiempoComidaEntity, TotalesEntity } from '../planes/planes.entity.js';

export class PlanHoyEntity {
  id: string;
  /** @example "Plan inicial" */
  nombre: string;
  /** @example 1430 */
  kcalObjetivo: number;
  totales: TotalesEntity;
}

export class TiempoHoyEntity extends TiempoComidaEntity {
  /** Registro del día para este tiempo de comida, si ya lo marcó. */
  registro: RegistroComidaEntity | null;
}

export class HoyEntity {
  /** @example "2026-10-28" */
  fecha: string;
  /** null si el paciente no tiene plan activo. */
  plan: PlanHoyEntity | null;
  tiempos: TiempoHoyEntity[];
  /** @example 2 */
  cumplidos: number;
  proximaCita: CitaAgendaEntity | null;
}

export class NutricionistaDeCitaEntity {
  /** @example "Lic. Sofía Herrera" */
  nombre: string;
}

export class CitaPacienteEntity extends CitaAgendaEntity {
  nutricionista: NutricionistaDeCitaEntity;
}
