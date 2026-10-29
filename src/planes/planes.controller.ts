import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import { TipoComida } from '../generated/prisma/enums.js';
import {
  ActualizarPlanDto,
  GenerarPlanDto,
  ReemplazarItemsDto,
} from './planes.dto.js';
import { PlanDetalleEntity, PlanEntity } from './planes.entity.js';
import { PlanesService } from './planes.service.js';

const ID_PLAN = ApiParam({
  name: 'id',
  description: 'ID del plan',
  format: 'uuid',
});

@ApiTags('planes')
@ApiBearerAuth()
@Roles('nutricionista')
@ApiErrores()
@Controller()
export class PlanesController {
  constructor(private readonly service: PlanesService) {}

  @Get('pacientes/:id/planes')
  @ApiParam({ name: 'id', description: 'ID del paciente', format: 'uuid' })
  @ApiOperation({
    summary: 'Planes del paciente',
    description: 'Del más reciente al más antiguo, sin detalle.',
  })
  @ApiOkResponse({ type: [PlanEntity] })
  @ApiErrores(404)
  listar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listar(id, u.nutricionistaId!);
  }

  @Post('pacientes/:id/planes/generar')
  @ApiParam({ name: 'id', description: 'ID del paciente', format: 'uuid' })
  @ApiOperation({
    summary: 'Generar plan con el recomendador',
    description: [
      'Crea un plan en `BORRADOR`:',
      '1. Calcula kcal y macros con Mifflin-St Jeor (o usa `kcalObjetivo`).',
      '2. Filtra el catálogo por las restricciones del paciente.',
      '3. Si `usarIa` (por defecto), AWS Bedrock propone alimentos y porciones.',
      '4. El backend descarta alimentos inexistentes y ajusta porciones a ±10 % por tiempo de comida.',
      '5. Si la IA no está disponible usa reglas (`origen = REGLAS`).',
      '6. Cada ítem queda atado a la versión vigente del alimento, y los totales salen de ella.',
      '',
      'Requiere al menos una medición del paciente.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: PlanDetalleEntity })
  @ApiErrores(400, 404)
  generar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerarPlanDto,
  ) {
    return this.service.generar(id, u.nutricionistaId!, dto);
  }

  @Get('planes/:id')
  @ID_PLAN
  @ApiOperation({
    summary: 'Detalle del plan',
    description:
      'Tiempos de comida con alimentos, totales y desviación contra la meta. Cada ítem declara la versión del alimento que usó y los totales salen de esa versión: editar el alimento no cambia un plan existente.',
  })
  @ApiOkResponse({ type: PlanDetalleEntity })
  @ApiErrores(404)
  detalle(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id, u.nutricionistaId!);
  }

  @Patch('planes/:id')
  @ID_PLAN
  @ApiOperation({
    summary: 'Editar datos del plan',
    description:
      'Nombre, metas y justificación. No permitido en planes archivados.',
  })
  @ApiOkResponse({ type: PlanDetalleEntity })
  @ApiErrores(400, 404)
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlanDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }

  @Put('planes/:id/tiempos/:tipo/items')
  @ID_PLAN
  @ApiParam({ name: 'tipo', enum: TipoComida, enumName: 'TipoComida' })
  @ApiOperation({
    summary: 'Reemplazar alimentos de un tiempo de comida',
    description:
      'Edición manual: reemplaza la lista completa del tiempo indicado. Los ítems nuevos quedan atados a la versión vigente de cada alimento.',
  })
  @ApiOkResponse({ type: PlanDetalleEntity })
  @ApiErrores(400, 404)
  reemplazarItems(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tipo', new ParseEnumPipe(TipoComida)) tipo: TipoComida,
    @Body() dto: ReemplazarItemsDto,
  ) {
    return this.service.reemplazarItems(id, tipo, u.nutricionistaId!, dto);
  }

  @Post('planes/:id/activar')
  @ID_PLAN
  @ApiOperation({
    summary: 'Aprobar y activar el plan',
    description:
      'Queda `ACTIVO` y visible en la app del paciente; el plan activo anterior pasa a `ARCHIVADO`.',
  })
  @ApiCreatedResponse({ type: PlanDetalleEntity })
  @ApiErrores(400, 404)
  activar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activar(id, u.nutricionistaId!);
  }

  @Delete('planes/:id')
  @HttpCode(204)
  @ID_PLAN
  @ApiOperation({
    summary: 'Eliminar borrador',
    description: 'Solo planes en `BORRADOR`.',
  })
  @ApiNoContentResponse({ description: 'Eliminado.' })
  @ApiErrores(400, 404)
  eliminar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminar(id, u.nutricionistaId!);
  }
}
