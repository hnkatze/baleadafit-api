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
  /** @example "Refiere hambre a media tarde y poca sed." */
  subjetivo: string | null;
  /** @example "Peso 78.4 kg, cintura 92 cm, presión 118/76." */
  objetivo: string | null;
  /** @example "Adherencia parcial al plan; pérdida de 1.2 kg en 4 semanas." */
  analisis: string | null;
  /** @example "Agregar merienda de fruta con yogur y control en 4 semanas." */
  plan: string | null;
  /** @example "2026-12-01T00:00:00.000Z" */
  proximaCitaSugerida: Date | null;
}
