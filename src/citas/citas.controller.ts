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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import {
  ActualizarCitaDto,
  BuscarCitasDto,
  CrearCitaDto,
} from './citas.dto.js';
import { CitasService } from './citas.service.js';

@ApiTags('citas (nutricionista)')
@ApiBearerAuth()
@Roles('nutricionista')
@Controller('citas')
export class CitasController {
  constructor(private readonly service: CitasService) {}

  @Get()
  listar(@UsuarioAct() u: UsuarioActual, @Query() q: BuscarCitasDto) {
    return this.service.listar(u.nutricionistaId!, q);
  }

  @Post()
  crear(@UsuarioAct() u: UsuarioActual, @Body() dto: CrearCitaDto) {
    return this.service.crear(u.nutricionistaId!, dto);
  }

  /** Reprogramar, completar o cancelar (estado = CANCELADA). */
  @Patch(':id')
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCitaDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }
}
