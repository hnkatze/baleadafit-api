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

export class CitaEntity extends CitaBasicaEntity {
  paciente: PacienteDeCitaEntity;
}
