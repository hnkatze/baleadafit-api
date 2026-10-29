import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { aFecha, hoyIso, sumarDias } from '../common/fechas.js';
import { PacientesModule } from '../pacientes/pacientes.module.js';
import { PacientesService } from '../pacientes/pacientes.service.js';
import { PlanesModule } from '../planes/planes.module.js';
import { PlanesService } from '../planes/planes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class RegistrarComidaDto {
  @IsUUID()
  tiempoComidaId: string;

  /** YYYY-MM-DD. Por defecto, hoy. */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsBoolean()
  cumplido: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

/** Lo que ve y registra el paciente en la app. Siempre limitado a sus propios datos. */
@Injectable()
export class MiCuentaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planes: PlanesService,
  ) {}

  async planActivo(pacienteId: string) {
    const plan = await this.prisma.planAlimenticio.findFirst({
      where: { pacienteId, estado: 'ACTIVO' },
      select: { id: true },
    });
    return plan ? this.planes.detalleConTotales(plan.id) : null;
  }

  /** Pantalla "Hoy": comidas del plan activo, si ya las registró y la próxima cita. */
  async hoy(pacienteId: string, fecha = hoyIso()) {
    const dia = aFecha(fecha);
    const [plan, registros, proximaCita] = await Promise.all([
      this.planActivo(pacienteId),
      this.prisma.registroComida.findMany({
        where: { pacienteId, fecha: dia },
      }),
      this.prisma.cita.findFirst({
        where: {
          pacienteId,
          estado: 'PROGRAMADA',
          fechaHora: { gte: new Date() },
        },
        orderBy: { fechaHora: 'asc' },
      }),
    ]);
    const tiempos = (plan?.tiempos ?? []).map((t) => ({
      ...t,
      registro: registros.find((r) => r.tiempoComidaId === t.id) ?? null,
    }));
    return {
      fecha,
      plan: plan && {
        id: plan.id,
        nombre: plan.nombre,
        kcalObjetivo: plan.kcalObjetivo,
        totales: plan.totales,
      },
      tiempos,
      cumplidos: tiempos.filter((t) => t.registro?.cumplido).length,
      proximaCita,
    };
  }

  citas(pacienteId: string) {
    return this.prisma.cita.findMany({
      where: { pacienteId },
      orderBy: { fechaHora: 'desc' },
      include: { nutricionista: { select: { nombre: true } } },
    });
  }

  async registrar(pacienteId: string, dto: RegistrarComidaDto) {
    const tiempo = await this.prisma.tiempoComida.findFirst({
      where: { id: dto.tiempoComidaId, plan: { pacienteId } },
    });
    if (!tiempo)
      throw new NotFoundException(
        'Tiempo de comida no encontrado en tus planes.',
      );
    const fecha = aFecha(dto.fecha ?? hoyIso());
    return this.prisma.registroComida.upsert({
      where: {
        pacienteId_tiempoComidaId_fecha: {
          pacienteId,
          tiempoComidaId: tiempo.id,
          fecha,
        },
      },
      create: {
        pacienteId,
        tiempoComidaId: tiempo.id,
        fecha,
        cumplido: dto.cumplido,
        comentario: dto.comentario,
      },
      update: { cumplido: dto.cumplido, comentario: dto.comentario },
    });
  }

  registros(pacienteId: string, desde?: string, hasta?: string) {
    const fin = aFecha(hasta ?? hoyIso());
    const inicio = desde ? aFecha(desde) : sumarDias(fin, -6);
    return this.prisma.registroComida.findMany({
      where: { pacienteId, fecha: { gte: inicio, lte: fin } },
      orderBy: { fecha: 'desc' },
      include: { tiempoComida: { select: { tipo: true } } },
    });
  }
}

@ApiTags('mi cuenta (paciente)')
@ApiBearerAuth()
@Roles('paciente')
@Controller('me')
export class MiCuentaController {
  constructor(
    private readonly service: MiCuentaService,
    private readonly pacientes: PacientesService,
  ) {}

  @Get('hoy')
  hoy(@UsuarioAct() u: UsuarioActual, @Query('fecha') fecha?: string) {
    return this.service.hoy(u.pacienteId!, fecha);
  }

  @Get('plan')
  plan(@UsuarioAct() u: UsuarioActual) {
    return this.service.planActivo(u.pacienteId!);
  }

  @Get('mediciones')
  mediciones(@UsuarioAct() u: UsuarioActual) {
    return this.pacientes.listarMediciones(u.pacienteId!);
  }

  @Get('citas')
  citas(@UsuarioAct() u: UsuarioActual) {
    return this.service.citas(u.pacienteId!);
  }

  /** Marca un tiempo de comida como cumplido o no (crea o actualiza el registro del día). */
  @Put('registros')
  registrar(@UsuarioAct() u: UsuarioActual, @Body() dto: RegistrarComidaDto) {
    return this.service.registrar(u.pacienteId!, dto);
  }

  @Get('registros')
  registros(
    @UsuarioAct() u: UsuarioActual,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.registros(u.pacienteId!, desde, hasta);
  }
}

@Module({
  imports: [PlanesModule, PacientesModule],
  controllers: [MiCuentaController],
  providers: [MiCuentaService],
})
export class MiCuentaModule {}
