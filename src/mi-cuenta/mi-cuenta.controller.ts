import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import {
  MedicionConImcEntity,
  RegistroComidaConTipoEntity,
  RegistroComidaEntity,
} from '../pacientes/pacientes.entity.js';
import { PacientesService } from '../pacientes/pacientes.service.js';
import { PlanDetalleEntity } from '../planes/planes.entity.js';
import { RegistrarComidaDto } from './mi-cuenta.dto.js';
import { CitaPacienteEntity, HoyEntity } from './mi-cuenta.entity.js';
import { MiCuentaService } from './mi-cuenta.service.js';

@ApiTags('mi cuenta (paciente)')
@ApiBearerAuth()
@Roles('paciente')
@ApiErrores()
@Controller('me')
export class MiCuentaController {
  constructor(
    private readonly service: MiCuentaService,
    private readonly pacientes: PacientesService,
  ) {}

  @Get('hoy')
  @ApiOperation({
    summary: 'Pantalla Hoy',
    description:
      'Comidas del plan activo con su registro del día, comidas cumplidas y próxima cita.',
  })
  @ApiQuery({
    name: 'fecha',
    required: false,
    description: 'YYYY-MM-DD (por defecto hoy)',
    example: '2026-10-28',
  })
  @ApiOkResponse({ type: HoyEntity })
  hoy(@UsuarioAct() u: UsuarioActual, @Query('fecha') fecha?: string) {
    return this.service.hoy(u.pacienteId!, fecha);
  }

  @Get('plan')
  @ApiOperation({
    summary: 'Mi plan activo',
    description:
      'Plan completo con totales. Responde `null` si la nutricionista aún no activa uno.',
  })
  @ApiOkResponse({
    type: PlanDetalleEntity,
    description: 'Plan activo o null.',
  })
  plan(@UsuarioAct() u: UsuarioActual) {
    return this.service.planActivo(u.pacienteId!);
  }

  @Get('mediciones')
  @ApiOperation({
    summary: 'Mi progreso',
    description: 'Mediciones con IMC, de la más antigua a la más reciente.',
  })
  @ApiOkResponse({ type: [MedicionConImcEntity] })
  mediciones(@UsuarioAct() u: UsuarioActual) {
    return this.pacientes.listarMediciones(u.pacienteId!);
  }

  @Get('citas')
  @ApiOperation({
    summary: 'Mis citas',
    description: 'Todas, de la más reciente a la más antigua.',
  })
  @ApiOkResponse({ type: [CitaPacienteEntity] })
  citas(@UsuarioAct() u: UsuarioActual) {
    return this.service.citas(u.pacienteId!);
  }

  @Put('registros')
  @ApiOperation({
    summary: 'Registrar comida',
    description:
      'Marca un tiempo de comida como cumplido o no en una fecha. Si ya existe, lo actualiza.',
  })
  @ApiOkResponse({ type: RegistroComidaEntity })
  @ApiErrores(400, 404)
  registrar(@UsuarioAct() u: UsuarioActual, @Body() dto: RegistrarComidaDto) {
    return this.service.registrar(u.pacienteId!, dto);
  }

  @Get('registros')
  @ApiOperation({
    summary: 'Mi diario de comidas',
    description: 'Por defecto, los últimos 7 días.',
  })
  @ApiQuery({ name: 'desde', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'YYYY-MM-DD (por defecto hoy)',
  })
  @ApiOkResponse({ type: [RegistroComidaConTipoEntity] })
  registros(
    @UsuarioAct() u: UsuarioActual,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.registros(u.pacienteId!, desde, hasta);
  }
}
