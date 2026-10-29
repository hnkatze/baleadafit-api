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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import {
  ActualizarPacienteDto,
  BuscarPacientesDto,
  CrearMedicionDto,
  CrearPacienteDto,
} from './pacientes.dto.js';
import { PacientesService } from './pacientes.service.js';

@ApiTags('pacientes (nutricionista)')
@ApiBearerAuth()
@Roles('nutricionista')
@Controller()
export class PacientesController {
  constructor(private readonly service: PacientesService) {}

  @Get('pacientes')
  listar(@UsuarioAct() u: UsuarioActual, @Query() q: BuscarPacientesDto) {
    return this.service.listar(u.nutricionistaId!, q);
  }

  @Post('pacientes')
  crear(@UsuarioAct() u: UsuarioActual, @Body() dto: CrearPacienteDto) {
    return this.service.crear(u.nutricionistaId!, dto);
  }

  @Get('pacientes/:id')
  detalle(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id, u.nutricionistaId!);
  }

  @Patch('pacientes/:id')
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPacienteDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }

  @Delete('pacientes/:id')
  desactivar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.desactivar(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/mediciones')
  mediciones(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.mediciones(id, u.nutricionistaId!);
  }

  @Post('pacientes/:id/mediciones')
  agregarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearMedicionDto,
  ) {
    return this.service.agregarMedicion(id, u.nutricionistaId!, dto);
  }

  @Delete('mediciones/:id')
  @HttpCode(204)
  eliminarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminarMedicion(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/requerimiento')
  requerimiento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.requerimiento(id, u.nutricionistaId!);
  }

  /** Registros del diario del paciente y % de cumplimiento (por defecto, últimos 14 días). */
  @Get('pacientes/:id/adherencia')
  adherencia(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.adherencia(id, u.nutricionistaId!, desde, hasta);
  }
}
