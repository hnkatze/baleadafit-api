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
  /** `firebase_uid` del dueño del dispositivo. */
  uid: string;
  /** Rol con el que se registró: `nutricionista` o `paciente`. */
  rol: string;
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
