/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { CitaEntity } from '../citas/citas.entity.js';

export class SaludEntity {
  /** @example "baleadafit-api" */
  servicio: string;
  /** @example "ok" */
  estado: string;
}

export class DashboardEntity {
  /** @example 24 */
  pacientesActivos: number;
  /** @example 3 */
  planesEnBorrador: number;
  /** Citas de hoy que no están canceladas. */
  citasHoy: CitaEntity[];
}
