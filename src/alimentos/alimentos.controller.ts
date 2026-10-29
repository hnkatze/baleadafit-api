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
import { Roles } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import {
  CondicionEntity,
  RestriccionEntity,
} from '../pacientes/pacientes.entity.js';
import {
  ActualizarAlimentoDto,
  BuscarAlimentosDto,
  CrearAlimentoDto,
} from './alimentos.dto.js';
import { AlimentoEntity } from './alimentos.entity.js';
import { AlimentosService } from './alimentos.service.js';

const ID_ALIMENTO = ApiParam({
  name: 'id',
  description: 'ID del alimento',
  format: 'uuid',
});

@ApiTags('catálogo')
@ApiBearerAuth()
@Roles('nutricionista', 'paciente')
@ApiErrores()
@Controller()
export class AlimentosController {
  constructor(private readonly service: AlimentosService) {}

  @Get('alimentos')
  @ApiOperation({
    summary: 'Buscar alimentos',
    description:
      'Catálogo activo. `excluir=lactosa,gluten` quita los alimentos que contienen esas etiquetas.',
  })
  @ApiOkResponse({ type: [AlimentoEntity] })
  @ApiErrores(400)
  listar(@Query() q: BuscarAlimentosDto) {
    return this.service.listar(q);
  }

  @Get('alimentos/:id')
  @ID_ALIMENTO
  @ApiOperation({ summary: 'Detalle de un alimento' })
  @ApiOkResponse({ type: AlimentoEntity })
  @ApiErrores(404)
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(id);
  }

  @Roles('nutricionista')
  @Post('alimentos')
  @ApiOperation({
    summary: 'Agregar alimento',
    description: 'Solo nutricionistas. Valores por porción.',
  })
  @ApiCreatedResponse({ type: AlimentoEntity })
  @ApiErrores(400, 409)
  crear(@Body() dto: CrearAlimentoDto) {
    return this.service.crear(dto);
  }

  @Roles('nutricionista')
  @Patch('alimentos/:id')
  @ID_ALIMENTO
  @ApiOperation({
    summary: 'Editar alimento',
    description:
      'Solo nutricionistas. `activo = false` lo saca del catálogo sin borrarlo.',
  })
  @ApiOkResponse({ type: AlimentoEntity })
  @ApiErrores(400, 404)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAlimentoDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Get('restricciones')
  @ApiOperation({
    summary: 'Listar restricciones alimentarias',
    description: 'Sus `codigo` se usan al crear pacientes y en `excluir`.',
  })
  @ApiOkResponse({ type: [RestriccionEntity] })
  restricciones() {
    return this.service.restricciones();
  }

  @Get('condiciones')
  @ApiOperation({
    summary: 'Listar condiciones clínicas',
    description:
      'Catálogo de condiciones (diabetes, HTA, ERC…). Sus `codigo` se usan en `condiciones` al crear o actualizar pacientes.',
  })
  @ApiOkResponse({ type: [CondicionEntity] })
  condiciones() {
    return this.service.condiciones();
  }
}
