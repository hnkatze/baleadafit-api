/* Modelo de respuesta para la documentación de Swagger (no se instancia). */
import { CitaBasicaEntity } from '../pacientes/pacientes.entity.js';

export class PacienteDeCitaEntity {
  id: string;
  /** @example "Ana" */
  nombre: string;
  /** @example "López" */
  apellido: string;
  telefono: string | null;
}

/** Cita con su paciente. El SOAP y la próxima fecha vienen de `CitaBasicaEntity`. */
export class CitaEntity extends CitaBasicaEntity {
  paciente: PacienteDeCitaEntity;
}
