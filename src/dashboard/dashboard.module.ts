import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Public, Roles, UsuarioAct } from '../auth/decorators.js';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  salud() {
    return { servicio: 'baleadafit-api', estado: 'ok' };
  }

  /** Resumen para la pantalla de inicio de la nutricionista. */
  @ApiBearerAuth()
  @Roles('nutricionista')
  @Get('dashboard')
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
          paciente: { select: { id: true, nombre: true, apellido: true } },
        },
      }),
    ]);
    return { pacientesActivos, planesEnBorrador: borradores, citasHoy };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
