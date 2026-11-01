export type Rol = 'nutricionista' | 'paciente' | 'sin_perfil';

export interface UsuarioActual {
  uid: string;
  email?: string;
  /** El token de Firebase afirma que el correo está verificado. */
  emailVerificado: boolean;
  rol: Rol;
  nutricionistaId?: string;
  pacienteId?: string;
}

export interface TokenVerificado {
  uid: string;
  email?: string;
  emailVerificado: boolean;
}
