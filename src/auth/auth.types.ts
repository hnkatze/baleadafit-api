import type { EstadoNutricionista } from '../generated/prisma/enums.js';

/**
 * Rol derivado de la cuenta, nunca guardado como columna.
 *
 * `nutricionista_pendiente` existe para que la aprobación bloquee de verdad: los
 * `@Roles('nutricionista')` ya escritos rechazan ese rol sin tocar un controller.
 */
export type Rol =
  | 'nutricionista'
  | 'nutricionista_pendiente'
  | 'paciente'
  | 'sin_perfil';

export interface UsuarioActual {
  uid: string;
  email?: string;
  /** El token de Firebase afirma que el correo está verificado. */
  emailVerificado: boolean;
  rol: Rol;
  /**
   * Ortogonal al rol: administrar el board no es un perfil del dominio. Un
   * nutricionista puede ser admin sin perder su `nutricionistaId`.
   */
  esAdmin: boolean;
  nutricionistaId?: string;
  pacienteId?: string;
  /** Estado de aprobación; undefined fuera de los perfiles de nutricionista. */
  estado?: EstadoNutricionista;
}

export interface TokenVerificado {
  uid: string;
  email?: string;
  emailVerificado: boolean;
}
