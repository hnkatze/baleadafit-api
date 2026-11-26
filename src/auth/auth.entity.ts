/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';
import { EstadoNutricionista } from '../generated/prisma/enums.js';

export class NutricionistaEntity {
  id: string;
  firebaseUid: string;
  /** @example "Lic. Sofía Herrera" */
  nombre: string;
  /** @example "sofia@clinica.hn" */
  correo: string;
  /** @example "1402" */
  colegiado: string | null;
  telefono: string | null;
  @ApiProperty({ enum: EstadoNutricionista, enumName: 'EstadoNutricionista' })
  estado: EstadoNutricionista;
  /** Por qué se rechazó el perfil. null si no está rechazado. */
  motivoRechazo: string | null;
  /** @example "1990-03-15" */
  fechaNacimiento: Date | null;
  creadoEn: Date;
}

export class MeEntity {
  @ApiProperty({
    enum: [
      'nutricionista',
      'nutricionista_pendiente',
      'paciente',
      'sin_perfil',
    ],
    description:
      'Define qué navegación muestra la app. `nutricionista_pendiente` es un perfil registrado que todavía no fue aprobado: la app muestra el estado de revisión y las rutas de datos responden 403.',
  })
  rol:
    | 'nutricionista'
    | 'nutricionista_pendiente'
    | 'paciente'
    | 'sin_perfil';

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'Nutricionista (con `estado` y `fechaNacimiento`), o paciente con su nutricionista y restricciones. null si no tiene perfil.',
  })
  perfil: Record<string, unknown> | null;

  @ApiProperty({
    description:
      'La cuenta puede aprobar o rechazar perfiles de nutricionista. No es un rol: se deriva de la lista de correos administradores y exige el correo verificado. Es ortogonal al rol, así que una nutricionista aprobada puede ser admin.',
  })
  esAdmin: boolean;
}
