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
import { Roles } from '../auth/decorators.js';
import {
  ActualizarAlimentoDto,
  BuscarAlimentosDto,
  CrearAlimentoDto,
} from './alimentos.dto.js';
import { AlimentosService } from './alimentos.service.js';

@ApiTags('catálogo')
@ApiBearerAuth()
@Roles('nutricionista', 'paciente')
@Controller()
export class AlimentosController {
  constructor(private readonly service: AlimentosService) {}

  @Get('alimentos')
  listar(@Query() q: BuscarAlimentosDto) {
    return this.service.listar(q);
  }

  @Get('alimentos/:id')
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(id);
  }

  @Roles('nutricionista')
  @Post('alimentos')
  crear(@Body() dto: CrearAlimentoDto) {
    return this.service.crear(dto);
  }

  @Roles('nutricionista')
  @Patch('alimentos/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAlimentoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Get('restricciones')
  restricciones() {
    return this.service.restricciones();
  }
}
