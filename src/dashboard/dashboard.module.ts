import { Controller, Get, Module } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Public, Roles, UsuarioAct } from '../auth/decorators.js';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import { ApiErrores } from '../common/swagger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardEntity, SaludEntity } from './dashboard.entity.js';

@Controller()
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiTags('salud')
  @ApiOperation({
    summary: 'Estado del servicio',
    description: 'No requiere token.',
  })
  @ApiOkResponse({ type: SaludEntity })
  salud() {
    return { servicio: 'baleadafit-api', estado: 'ok' };
  }

  @ApiTags('dashboard')
  @ApiBearerAuth()
  @Roles('nutricionista')
  @Get('dashboard')
  @ApiOperation({
    summary: 'Resumen de inicio',
    description:
      'Pacientes activos, planes en borrador y citas de hoy (sin canceladas).',
  })
  @ApiOkResponse({ type: DashboardEntity })
  @ApiErrores()
  async resumen(@UsuarioAct() u: UsuarioActual) {
    const nutricionistaId = u.nutricionistaId!;
    const inicioDia = aFecha(hoyIso());
    const finDia = sumarDias(inicioDia, 1);
    const [pacientesActivos, borradores, citasHoy] = await Promise.all([
      this.prisma.paciente.count({ where: { nutricionistaId, activo: true } }),
      this.prisma.planAlimenticio.count({
        where: { nutricionistaId, estado: 'BORRADOR' },
      }),
      this.prisma.cita.findMany({
        where: {
          nutricionistaId,
          fechaHora: { gte: inicioDia, lt: finDia },
          estado: { not: 'CANCELADA' },
        },
        orderBy: { fechaHora: 'asc' },
        include: {
          paciente: {
            select: { id: true, nombre: true, apellido: true, telefono: true },
          },
        },
      }),
    ]);
    return { pacientesActivos, planesEnBorrador: borradores, citasHoy };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
