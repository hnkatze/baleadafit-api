/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';
import { EstadoNutricionista } from '../generated/prisma/enums.js';

/** Perfil que ve el admin en el board de aprobación. Nunca sale `firebaseUid`. */
export class NutricionistaAdminEntity {
  /** @example "7c1f6a2e-1b2c-4d5e-8f90-1234567890ab" */
  id: string;
  /** @example "Lic. Sofía Herrera" */
  nombre: string;
  /** @example "sofia@clinica.hn" */
  correo: string;
  /** @example "1402" */
  colegiado: string | null;
  /** @example "+504 9999-0000" */
  telefono: string | null;
  @ApiProperty({ enum: EstadoNutricionista, enumName: 'EstadoNutricionista' })
  estado: EstadoNutricionista;
  /** Por qué se rechazó. null mientras el perfil no esté rechazado. */
  /** @example "El número de colegiada no aparece en el registro del Colegio" */
  motivoRechazo: string | null;
  /** @example "1990-03-15" */
  fechaNacimiento: Date | null;
  /** Cuándo se registró: los más viejos son los que más esperaron. */
  creadoEn: Date;
}
