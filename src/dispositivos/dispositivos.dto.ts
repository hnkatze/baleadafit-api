import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Plataforma } from '../generated/prisma/enums.js';

/** Lo que manda la app al iniciar sesión: el token que le dio FCM y su plataforma. */
export class RegistrarDispositivoDto {
  /**
   * Token de registro de FCM. Llega del SDK del dispositivo y cambia cuando la
   * app se reinstala, así que se vuelve a registrar en cada arranque de sesión.
   * @example "fMEr1:APA91bH..."
   */
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;

  @ApiProperty({ enum: Plataforma, enumName: 'Plataforma' })
  @IsEnum(Plataforma)
  plataforma: Plataforma;
}
