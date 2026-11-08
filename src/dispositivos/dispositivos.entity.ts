/* Modelo de respuesta para la documentación de Swagger (no se instancia). */
import { ApiProperty } from '@nestjs/swagger';
import { Plataforma } from '../generated/prisma/enums.js';

/** Un dispositivo que puede recibir push de esta cuenta. */
export class DispositivoEntity {
  id: string;
  /** Token de registro de FCM. */
  token: string;
  @ApiProperty({ enum: Plataforma, enumName: 'Plataforma' })
  plataforma: Plataforma;
  /**
   * Perfil dueño del dispositivo. No se guarda como columna: se deriva de cuál
   * de las dos claves foráneas tiene valor.
   */
  @ApiProperty({ enum: ['nutricionista', 'paciente'] })
  rol: 'nutricionista' | 'paciente';
  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn: Date;
  /** Última vez que la app registró este token. */
  @ApiProperty({ type: String, format: 'date-time' })
  ultimoUso: Date;
}

/** Lo que devuelve dar de baja un dispositivo. */
export class DispositivoEliminadoEntity {
  token: string;
  eliminado: boolean;
}
