/* Modelos de respuesta para la documentación de Swagger (no se instancian). */
import { ApiProperty } from '@nestjs/swagger';

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
  creadoEn: Date;
}

export class MeEntity {
  @ApiProperty({
    enum: ['nutricionista', 'paciente', 'sin_perfil'],
    description: 'Define qué navegación muestra la app.',
  })
  rol: 'nutricionista' | 'paciente' | 'sin_perfil';

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'Nutricionista, o paciente con su nutricionista y restricciones. null si no tiene perfil.',
  })
  perfil: Record<string, unknown> | null;
}
