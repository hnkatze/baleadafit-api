import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import {
  ActualizarCitaDto,
  BuscarCitasDto,
  CrearCitaDto,
} from './citas.dto.js';
import { CitaEntity } from './citas.entity.js';
import { CitasService } from './citas.service.js';

@ApiTags('citas')
@ApiBearerAuth()
@Roles('nutricionista')
@ApiErrores()
@Controller('citas')
export class CitasController {
  constructor(private readonly service: CitasService) {}

  @Get()
  @ApiOperation({
    summary: 'Agenda',
    description:
      'Citas de la nutricionista ordenadas por fecha, con filtros opcionales.',
  })
  @ApiOkResponse({ type: [CitaEntity] })
  @ApiErrores(400)
  listar(@UsuarioAct() u: UsuarioActual, @Query() q: BuscarCitasDto) {
    return this.service.listar(u.nutricionistaId!, q);
  }

  @Post()
  @ApiOperation({
    summary: 'Programar cita',
    description: 'Responde 409 si se traslapa con otra cita programada.',
  })
  @ApiCreatedResponse({ type: CitaEntity })
  @ApiErrores(400, 404, 409)
  crear(@UsuarioAct() u: UsuarioActual, @Body() dto: CrearCitaDto) {
    return this.service.crear(u.nutricionistaId!, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'ID de la cita', format: 'uuid' })
  @ApiOperation({
    summary: 'Reprogramar, completar o cancelar',
    description: 'Para cancelar, enviar `estado: "CANCELADA"`.',
  })
  @ApiOkResponse({ type: CitaEntity })
  @ApiErrores(400, 404, 409)
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCitaDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }
}
