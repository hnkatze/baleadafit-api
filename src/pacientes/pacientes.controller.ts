import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import {
  ActualizarPacienteDto,
  BuscarPacientesDto,
  CrearMedicionDto,
  CrearPacienteDto,
} from './pacientes.dto.js';
import {
  AdherenciaEntity,
  MedicionConImcEntity,
  PacienteConRestriccionesEntity,
  PacienteDetalleEntity,
  PacienteEntity,
  PacienteListadoEntity,
  RequerimientoEntity,
} from './pacientes.entity.js';
import { PacientesService } from './pacientes.service.js';

const ID_PACIENTE = ApiParam({
  name: 'id',
  description: 'ID del paciente',
  format: 'uuid',
});

@ApiTags('pacientes')
@ApiBearerAuth()
@Roles('nutricionista')
@ApiErrores()
@Controller()
export class PacientesController {
  constructor(private readonly service: PacientesService) {}

  @Get('pacientes')
  @ApiOperation({
    summary: 'Listar pacientes',
    description:
      'Pacientes de la nutricionista con su última medición y plan activo. Busca por nombre, apellido o correo.',
  })
  @ApiOkResponse({ type: [PacienteListadoEntity] })
  listar(@UsuarioAct() u: UsuarioActual, @Query() q: BuscarPacientesDto) {
    return this.service.listar(u.nutricionistaId!, q);
  }

  @Post('pacientes')
  @ApiOperation({
    summary: 'Crear paciente',
    description:
      'Con `correo`, el paciente queda vinculado al iniciar sesión en la app con ese correo verificado.',
  })
  @ApiCreatedResponse({ type: PacienteConRestriccionesEntity })
  @ApiErrores(400, 409)
  crear(@UsuarioAct() u: UsuarioActual, @Body() dto: CrearPacienteDto) {
    return this.service.crear(u.nutricionistaId!, dto);
  }

  @Get('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Expediente del paciente',
    description:
      'Restricciones, últimas 10 mediciones, próximas citas y planes.',
  })
  @ApiOkResponse({ type: PacienteDetalleEntity })
  @ApiErrores(404)
  detalle(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id, u.nutricionistaId!);
  }

  @Patch('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Actualizar paciente',
    description: 'Si se envía `restricciones`, reemplaza la lista completa.',
  })
  @ApiOkResponse({ type: PacienteConRestriccionesEntity })
  @ApiErrores(400, 404)
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPacienteDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }

  @Delete('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Dar de baja al paciente',
    description: 'Baja lógica (`activo = false`); el historial se conserva.',
  })
  @ApiOkResponse({ type: PacienteEntity })
  @ApiErrores(404)
  desactivar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.desactivar(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/mediciones')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Historial de mediciones',
    description: 'De la más antigua a la más reciente, con IMC.',
  })
  @ApiOkResponse({ type: [MedicionConImcEntity] })
  @ApiErrores(404)
  mediciones(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.mediciones(id, u.nutricionistaId!);
  }

  @Post('pacientes/:id/mediciones')
  @ID_PACIENTE
  @ApiOperation({ summary: 'Registrar medición' })
  @ApiCreatedResponse({ type: MedicionConImcEntity })
  @ApiErrores(400, 404)
  agregarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearMedicionDto,
  ) {
    return this.service.agregarMedicion(id, u.nutricionistaId!, dto);
  }

  @Delete('mediciones/:id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: 'ID de la medición', format: 'uuid' })
  @ApiOperation({ summary: 'Eliminar medición' })
  @ApiNoContentResponse({ description: 'Eliminada.' })
  @ApiErrores(404)
  eliminarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminarMedicion(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/requerimiento')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Requerimiento calórico',
    description:
      'Mifflin-St Jeor con la medición más reciente × factor de actividad ± ajuste por meta. Requiere al menos una medición.',
  })
  @ApiOkResponse({ type: RequerimientoEntity })
  @ApiErrores(400, 404)
  requerimiento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.requerimiento(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/adherencia')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Adherencia al plan',
    description:
      'Registros del diario del paciente y porcentaje de comidas cumplidas. Por defecto, los últimos 14 días.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'YYYY-MM-DD',
    example: '2026-10-15',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'YYYY-MM-DD (por defecto hoy)',
    example: '2026-10-28',
  })
  @ApiOkResponse({ type: AdherenciaEntity })
  @ApiErrores(404)
  adherencia(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.adherencia(id, u.nutricionistaId!, desde, hasta);
  }
}
